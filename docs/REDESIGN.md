# Angkor Architect cartoon art direction

The game uses an attractive cartoon direction inspired by the Khmer Angkor era: rounded sandstone lotus towers, sunny greenery, turquoise water, terracotta roofs, cream panels, leafy green buttons, and the locally hosted Fredoka display font. The menu and playable kingdom share this palette. Evening colors provide an optional darker interface.

## Interface and world

- Play, Continue, Settings, and How to play remain available on the illustrated menu.
- Floating kingdom navigation and closable information panels keep the map accessible.
- The construction dock collapses and supports keyboard categories (Left, Right, Home, End).
- The playable map uses brighter procedural terrain and foliage. The illustrated temple sprite is packed into the existing texture atlas for completed tower and relief stages, with a procedural fallback if the asset cannot load. Foundation artwork remains distinct.
- Settings and the guide pause the simulation. Save & return to main menu saves before leaving.
- Phone layouts provide scrolling resources and explicit camera buttons. Reduced-motion preferences are respected.

## Bundled artwork

Both assets were created using the built-in Image Generation tool:

- `public/art/angkor-cartoon.jpg`: cartoon temple-city menu background, converted from the generated PNG to JPEG.
- `public/art/temple-cartoon.png`: transparent lotus-tower temple sprite. Its transparency is preserved when drawn into the atlas.

These are stylized artistic interpretations of Khmer architecture. Artwork is served locally; no third-party image requests are needed at runtime. Generated source files remain in the tool’s generated-images directory.

### Menu generation prompt

> Use case: stylized-concept. Asset type: wide 16:9 background for the main menu of Angkor Architect, a charming cartoon city-building game inspired by the Khmer Angkor era. Create a gorgeous polished stylized 3D cartoon illustration, like a premium animated adventure game: chunky rounded sandstone Khmer prasat temples with iconic lotus-bud towers and simplified elegant carvings, terracotta-roofed wooden stilt homes, cheerful rounded jungle trees, coconut palms, little rice gardens, arched stone causeway, sparkling turquoise canals and baray reservoirs. A lush thriving miniature temple kingdom, viewed from an elevated three-quarter angle. Main big welcoming temple on the RIGHT HALF, small friendly Khmer builder characters in the distance, soft puffy clouds, blue sky, warm golden sunshine, floating lotus flowers. Left third has quiet dark green leafy foreground and open turquoise water, lower detail for menu text. Strong appealing silhouettes, soft bevels, hand-painted clean color blocks, rich but tasteful saturated greens and turquoise, buttery warm sandstone and coral accents, soft contact shadows and warm rim lighting. Cozy, playful, adventurous, beautiful, readable and inviting to all ages. This must look clearly CARTOON, not a photograph, not a realistic archaeological painting, not flat vector, not gritty, no gloomy cinematic haze. No text, no UI, no logo, no watermark, no modern buildings.

### Temple generation prompt

> Use case: stylized-concept. Asset type: isolated transparent-background building sprite for Angkor Architect, a polished cartoon isometric city-building game. A beautiful compact Khmer Angkor prasat temple complex, butter-yellow sandstone, a large central LOTUS-BUD tower and four charming smaller rounded lotus towers, stepped plinth with a broad front staircase, small elegant Khmer carvings and decorative naga railings. Premium colorful stylized 3D animated game art, rounded chunky beveled shapes, slightly exaggerated friendly proportions, warm sunlit upper-left faces and caramel shadows on right faces, crisp clean readable silhouette, attractive hand-painted texture with simplified blocks, consistent orthographic isometric view from above at 30 degrees showing two sides. The temple is aligned to an isometric diamond footprint, front stair points straight toward bottom center. Square composition; entire building visible, base spans most of image width, subject fills approximately 88 percent of canvas, no clipping. True fully TRANSPARENT background outside building and a faint compact contact shadow only. No ground island, no grass, no trees, no water, no characters, no scenery, no labels, no text, no UI, no checkerboard painted into image. Must be clearly cartoon, not realistic stone, not an ancient ruin.

## Verification

The production build and all 116 tests passed. Browser verification covered the cartoon menu, loading the illustrated temple into a saved kingdom, Continue, settings and evening colors, kingdom panels, camera controls, construction selection, and phone/tablet/desktop layouts. Simulation rules and saved kingdom data retain their existing format.
