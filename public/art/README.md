# 1-1 collage — visual asset provenance

This directory contains original SVG artwork for the 1-1 editorial reader and offline image fallbacks:

- `ink-brush.svg`: original vector brushwork with SVG turbulence/displacement.
- `ritual-chart.svg`: original decorative diagram of the author's ritual concept (an illustration, not a scientific claim).
- `hail-study.svg`: original illustration, **not a photograph or verified specimen of Osaka hail**.
- `buddha-study.svg`: original ink-print inspired statue illustration, used when the Commons image cannot load.
- `danjiri-etching.svg`: original decorative danjiri drawing, used as an offline fallback.
- `kappa-etching.svg`: original folkloric ink-style kappa illustration, used as an offline fallback.

The article loads the following free materials from Wikimedia Commons, with visible credits inside the expandable “図版出典とライセンス” section. The images are linked to their original source pages; the visitor's browser fetches them from Commons.

1. **Head of Buddha statue** — photo by Adbh266, [CC0](https://creativecommons.org/publicdomain/zero/1.0/). [Source](https://commons.wikimedia.org/wiki/File:Head_of_Buddha_statue.jpg).
2. **PersimmonWatercolor.jpg** — Japanese persimmon watercolor, Amanda A. Newton, USDA, Public Domain. [Source](https://commons.wikimedia.org/wiki/File:PersimmonWatercolor.jpg).
3. **SekienHyousube.jpg** — a Hyōsube, a type of Kappa, by Toriyama Sekien (1781), Public Domain. [Source](https://commons.wikimedia.org/wiki/File:SekienHyousube.jpg).
4. **2019 Danjiri festival at Otori Shrine008.jpg** — photo by Naokijp, [Creative Commons BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). [Source](https://commons.wikimedia.org/wiki/File:2019_Danjiri_festival_at_Otori_Shrine008.jpg). The website displays the photo with grayscale/color grading and cropping.

These materials are presented for illustration, not as documentary proof of the author's paranormal account. The manuscript is loaded verbatim from `public/data/thought-nodes.json`.

## Navigation and delivery

`public/thought.html` is the canonical collage reader; the site entrance continues to link to `thought.html#node-1-1`.
The standalone `/collage.html` route remains available as an equivalent preview. The manuscript is always read from `public/data/thought-nodes.json`; articles are not abbreviated, rewritten, or rehosted in JS.

The four Commons images are loaded in visitors' browsers with local SVG fallbacks, so all visual sections retain an illustration if a remote image is unavailable. Credits and license links remain visible at the bottom of 1-1. The reading UI includes a quieter mode, a contents index, scroll progress, keyboard arrows and guarded horizontal swipe chapter navigation.
