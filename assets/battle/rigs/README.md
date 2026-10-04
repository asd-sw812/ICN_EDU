# Connected battle rigs

These 96 bindings use the original uncut rear illustrations. The renderer reads the neutral `Rear_Body` surface from the existing Cubism MOC, subdivides its triangles with shared edge vertices, and applies continuous regional deformation weights in `connected-rig.js`.

Hair, clothing, arm and torso influences fade into neighbouring regions. This removes the disconnected rectangular cut-outs and mismatched overlay silhouettes in the previous renderer. Gun anchors follow the same deformation field used for the artwork.

This is a game-runtime rig rebuild using a shared Cubism surface. It is **not** 96 newly hand-authored Cubism Editor projects, nor a collection of independently painted, occlusion-complete layers. Existing CMO3 projects and old atlas exports are preserved as authoring history; the new renderer does not load those cut-out atlases.

`combat-director.js` sequences preparation, the character pose, contact effects and recovery. Ordinary attacks use a deck-specific shot, melee or environmental sequence. Support effects appear around the recipient. There are no illustrated ultimate cutscenes and no universal flying-token attack.

Verification performed without launching the game: real Cubism Core model loading, neutral-surface extraction, continuous weights, finite coordinates, triangle orientation across idle and attack poses, planted bottom vertices, four renderer loading cases, and all 24 deck / three-tier effect timelines. An isolated software-rendered comparison of the problematic bullet character was also reviewed. Browser/combat visual testing remains unperformed at the user's request.
