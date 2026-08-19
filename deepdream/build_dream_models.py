import json
import os
import shutil
import urllib.request

import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs

TILE = 96
LAYERS = ('mixed3', 'mixed5', 'mixed7')
OUT_ROOT = 'deepdream/model/dreams'
ASSET_FILE = 'deepdream/model/asset-banks.json'
CLASS_INDEX_URL = 'https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json'

# Each asset stays on one visual scale so repeated passes remain semantically coherent.
ASSET_SPECS = {
    'animals': {
        'label': '動物',
        'layer': 'mixed5',
        'keywords': [
            'retriever', 'terrier', 'spaniel', 'hound', 'fox', 'wolf', 'bear',
            'tiger_cat', 'tabby', 'lion', 'zebra', 'elephant', 'monkey', 'ape',
            'panda', 'rabbit', 'hare', 'hamster', 'koala', 'wombat',
        ],
    },
    'insects': {
        'label': '昆虫',
        'layer': 'mixed3',
        'keywords': [
            'butterfly', 'monarch', 'dragonfly', 'damselfly', 'bee', 'ant',
            'beetle', 'grasshopper', 'cricket', 'cockroach', 'mantis',
            'walking_stick', 'lacewing', 'fly',
        ],
    },
    'marine': {
        'label': '海洋生物',
        'layer': 'mixed5',
        'keywords': [
            'jellyfish', 'sea_anemone', 'coral_reef', 'starfish', 'sea_urchin',
            'lobster', 'crab', 'shrimp', 'octopus', 'squid', 'nautilus',
            'stingray', 'electric_ray', 'shark', 'whale', 'dolphin', 'seal',
            'sea_lion', 'loggerhead', 'leatherback',
        ],
    },
    'human': {
        'label': '人体',
        'layer': 'mixed7',
        'keywords': [
            'bridegroom', 'scuba_diver', 'ballplayer', 'swimmer', 'groom',
            'bikini', 'maillot', 'wig', 'sunglasses', 'jersey', 'lab_coat',
            'neck_brace', 'mask',
        ],
    },
    'plants': {
        'label': '植物',
        'layer': 'mixed3',
        'keywords': [
            'daisy', 'sunflower', 'orchid', 'flower', 'cabbage', 'broccoli',
            'cauliflower', 'artichoke', 'corn', 'acorn', 'buckeye', 'hip',
            'mushroom', 'bolete', 'stinkhorn', 'earthstar',
        ],
    },
}

Conv2D = tf.keras.layers.Conv2D
BatchNormalization = tf.keras.layers.BatchNormalization

# include_top=True is used only while deriving semantic channel banks.
classifier = tf.keras.applications.InceptionV3(include_top=True, weights='imagenet')


def predecessor(layer):
    hist = layer.input._keras_history
    prev = getattr(hist, 'layer', None)
    if prev is None:
        try:
            prev = hist[0]
        except Exception:
            prev = getattr(hist, 'operation', None)
    return prev


def build_fused(layer_name):
    source = tf.keras.Model(
        inputs=classifier.input,
        outputs=classifier.get_layer(layer_name).output,
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

    probe = tf.random.uniform([1, TILE, TILE, 3], -1.0, 1.0, dtype=tf.float32, seed=156)
    src_y = source(probe, training=False)
    fused_y = fused(probe, training=False)
    max_err = float(tf.reduce_max(tf.abs(src_y - fused_y)).numpy())
    if max_err > 2e-4:
        raise RuntimeError(f'{layer_name} BN fusion mismatch: {max_err}')

    channels = int(fused.output_shape[-1])
    sparse_ids = tf.constant(np.linspace(0, channels - 1, num=min(16, channels), dtype=np.int32))
    with tf.GradientTape() as tape:
        tape.watch(probe)
        activation = fused(probe, training=False)
        sparse = tf.gather(activation, sparse_ids, axis=-1)
        loss = tf.reduce_mean(sparse)
    grad = tape.gradient(loss, probe)
    if grad is None or not bool(tf.reduce_all(tf.math.is_finite(grad)).numpy()):
        raise RuntimeError(f'{layer_name} sparse gradient invalid')

    if any(isinstance(layer, BatchNormalization) for layer in fused.layers):
        raise RuntimeError(f'{layer_name}: BatchNormalization survived fusion')

    out = os.path.join(OUT_ROOT, layer_name)
    os.makedirs(out, exist_ok=True)
    tfjs.converters.save_keras_model(fused, out)
    print(
        f'{layer_name}: saved {fused.input_shape} -> {fused.output_shape}; '
        f'BN fused={len(bn_after_conv)}; max_err={max_err}; channels={channels}'
    )
    return source


def load_class_labels():
    with urllib.request.urlopen(CLASS_INDEX_URL, timeout=30) as response:
        raw = json.load(response)
    return {int(k): v[1].lower() for k, v in raw.items()}


def match_class_ids(labels, keywords):
    ids = []
    matched = []
    for idx, label in labels.items():
        if any(keyword in label for keyword in keywords):
            ids.append(idx)
            matched.append(label)
    if not ids:
        raise RuntimeError(f'No ImageNet classes matched: {keywords}')
    return sorted(set(ids)), sorted(set(matched))


def synthesize_group(class_ids, seed):
    # Small synthetic prototype. It is never shipped; it only asks the classifier
    # which visual channels support this semantic family.
    tf.random.set_seed(seed)
    x = tf.Variable(tf.random.uniform([1, 160, 160, 3], -0.25, 0.25, dtype=tf.float32))
    ids = tf.constant(class_ids, dtype=tf.int32)
    for _ in range(8):
        with tf.GradientTape() as tape:
            pred = classifier(x, training=False)
            selected = tf.gather(pred[0], ids)
            score = tf.math.log(tf.reduce_sum(selected) + 1e-8)
        grad = tape.gradient(score, x)
        std = tf.math.reduce_std(grad) + 1e-8
        x.assign(tf.clip_by_value(x + grad / std * 0.035, -1.0, 1.0))
    return x.read_value()


def derive_asset_bank(feature_model, class_ids):
    scores = None
    for seed in (23, 71):
        prototype = synthesize_group(class_ids, seed)
        activation = feature_model(prototype, training=False)
        channel_score = tf.reduce_mean(tf.nn.relu(activation), axis=[0, 1, 2]).numpy()
        scores = channel_score if scores is None else scores + channel_score
    scores /= 2.0
    count = min(28, scores.shape[0])
    top = np.argsort(scores)[-count:][::-1]
    return [int(x) for x in sorted(top.tolist())]


if os.path.isdir(OUT_ROOT):
    shutil.rmtree(OUT_ROOT)
os.makedirs(OUT_ROOT, exist_ok=True)
os.makedirs(os.path.dirname(ASSET_FILE), exist_ok=True)

feature_models = {}
for name in LAYERS:
    feature_models[name] = build_fused(name)

labels = load_class_labels()
asset_banks = {
    'version': 20,
    'model': 'InceptionV3 ImageNet / BN fused',
    'assets': {},
}

for key, spec in ASSET_SPECS.items():
    class_ids, matched = match_class_ids(labels, spec['keywords'])
    channels = derive_asset_bank(feature_models[spec['layer']], class_ids)
    asset_banks['assets'][key] = {
        'label': spec['label'],
        'layer': spec['layer'],
        'channels': channels,
        'class_count': len(class_ids),
        'matched_labels': matched,
    }
    print(f"asset {key}: layer={spec['layer']} classes={len(class_ids)} channels={channels}")

with open(ASSET_FILE, 'w', encoding='utf-8') as f:
    json.dump(asset_banks, f, ensure_ascii=False, indent=2)

print('Semantic DeepDream asset banks built successfully.')
