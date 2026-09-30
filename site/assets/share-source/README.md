# Share image layers

`site/tools/brand-assets.html` is the editable composition for the 1200 × 630 social preview. The flower, ringed planet, vinyl record, and two app screens are separate image layers; the iPhone 17 Pro frames are drawn with `site/assets/iphone-17-pro.css`. This makes it possible to rearrange or replace a piece for another use without rebuilding the whole image.

`links-screen.png` is a capture of this page. `velour-screen.png` is a capture of the Velour editor. The flower and Refract objects are rendered cutouts for this graphic; they are not interactive 3D models.

Run `site/tools/render-brand-assets.mjs` with Playwright and Chrome available to export `site/assets/share-card.png` and the larger `site/shots/share-mockups.png` review image. Run `site/tools/build-public.mjs` afterward so the social metadata uses the new asset hash.
