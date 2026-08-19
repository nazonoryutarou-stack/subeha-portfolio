import os
import shutil
import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs

TILE = 96
LAYERS = ('mixed3', 'mixed5', 'mixed7')
OUT_ROOT = 'deepdream/model/dreams'

Conv2D = tf.keras.layers.Conv2D
BatchNormalization = tf.keras.layers.BatchNormalization

base = tf.keras.applications.InceptionV3(include_top=False, weights='imagenet')


def predecessor(layer):
    hist = layer.input._keras_history
    prev = getattr(hist, 'layer', None)
    if prev is None:
        try:
            prev = hist[0]
        except Exception:
            prev = getattr(hist, 'operation', None)
    return prev


def build_one(layer_name):
    source = tf.keras.Model(
        inputs=base.input,
        outputs=base.get_layer(layer_name).output,
        name=f'classic_deepdream_{layer_name}_source',
    )

    bn_after_conv = {}
    for layer in source.layers:
        if isinstance(layer, BatchNormalization):
            prev = predecessor(layer)
            if not isinstance(prev, Conv2D):
                raise RuntimeError(
                    f'Unexpected BN predecessor: {layer.name} <- {type(prev)}'
                )
            bn_after_conv[prev.name] = layer

    def clone_layer(layer):
        if isinstance(layer, Conv2D) and layer.name in bn_after_conv:
            cfg = layer.get_config()
            cfg['use_bias'] = True
            return Conv2D.from_config(cfg)
        if isinstance(layer, BatchNormalization):
            # Preserve graph topology and names, but BN math is folded into Conv2D.
            return tf.keras.layers.Activation('linear', name=layer.name)
        return layer.__class__.from_config(layer.get_config())

    fused = tf.keras.models.clone_model(source, clone_function=clone_layer)
    fused._name = f'classic_deepdream_{layer_name}_fusedbn'

    for old in source.layers:
        new = fused.get_layer(old.name)
        if isinstance(old, Conv2D) and old.name in bn_after_conv:
            weights = old.get_weights()
            if len(weights) != 1:
                raise RuntimeError(f'Expected bias-free conv: {old.name}')
            kernel = weights[0]
            bn = bn_after_conv[old.name]
            vals = bn.get_weights()
            i = 0
            if bn.scale:
                gamma = vals[i]
                i += 1
            else:
                gamma = np.ones(kernel.shape[-1], dtype=kernel.dtype)
            if bn.center:
                beta = vals[i]
                i += 1
            else:
                beta = np.zeros(kernel.shape[-1], dtype=kernel.dtype)
            moving_mean = vals[i]
            i += 1
            moving_var = vals[i]
            scale = gamma / np.sqrt(moving_var + bn.epsilon)
            fused_kernel = kernel * scale.reshape((1, 1, 1, -1))
            fused_bias = beta - moving_mean * scale
            new.set_weights([fused_kernel, fused_bias])
        elif isinstance(old, BatchNormalization):
            pass
        else:
            weights = old.get_weights()
            if weights:
                new.set_weights(weights)

    probe = tf.random.uniform(
        [1, TILE, TILE, 3], -1.0, 1.0, dtype=tf.float32, seed=156
    )
    src_y = source(probe, training=False)
    fused_y = fused(probe, training=False)
    max_err = float(tf.reduce_max(tf.abs(src_y - fused_y)).numpy())
    if max_err > 2e-4:
        raise RuntimeError(f'{layer_name} BN fusion mismatch: {max_err}')

    # Test both full activation and a sparse channel objective, because v19 uses both.
    channels = int(fused.output_shape[-1])
    sparse_ids = np.linspace(0, channels - 1, num=min(16, channels), dtype=np.int32)
    sparse_ids_tf = tf.constant(sparse_ids)
    with tf.GradientTape() as tape:
        tape.watch(probe)
        activation = fused(probe, training=False)
        sparse = tf.gather(activation, sparse_ids_tf, axis=-1)
        loss = tf.reduce_mean(sparse)
    grad = tape.gradient(loss, probe)
    if grad is None:
        raise RuntimeError(f'{layer_name} sparse gradient is None')
    if not bool(tf.reduce_all(tf.math.is_finite(grad)).numpy()):
        raise RuntimeError(f'{layer_name} sparse gradient contains non-finite values')

    if any(isinstance(layer, BatchNormalization) for layer in fused.layers):
        raise RuntimeError(f'{layer_name}: BatchNormalization survived fusion')

    out = os.path.join(OUT_ROOT, layer_name)
    os.makedirs(out, exist_ok=True)
    tfjs.converters.save_keras_model(fused, out)
    print(
        f'{layer_name}: saved {fused.input_shape} -> {fused.output_shape}; '
        f'BN fused={len(bn_after_conv)}; max_err={max_err}; channels={channels}'
    )


if os.path.isdir(OUT_ROOT):
    shutil.rmtree(OUT_ROOT)
os.makedirs(OUT_ROOT, exist_ok=True)

for name in LAYERS:
    build_one(name)

print('All multi-layer DeepDream models built successfully.')
