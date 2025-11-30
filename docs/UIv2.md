User Review Required
IMPORTANT

Color Opacity: I will significantly increase the base opacity of puzzle pieces to match the "100% Color Palette" requirement. Mascot Style: I will attempt to align the bubble tail and use "pixel-wise" elements (sharper borders/shadows) to match the blocky mascot character.

Proposed Changes
1. Mascot Refinement
[MODIFY] 
components/mascot/MascotPanel.tsx
Alignment: Adjust bottom and left positioning of the bubble to align the tail with the mascot's "head".
Style: Tweak border radius or shadow to feel more "pixel-wise" or grid-aligned if appropriate, while keeping the glass feel.
2. Center Card Visibility
[MODIFY] 
puzzle_session/components/CenterCard.tsx
Typography: Increase font size and weight for the central question.
Contrast: Darken the background (bg-slate-900 or similar) and ensure text is pure white.
Layout: Ensure it looks like the anchor in uploaded_image_2.
3. Color & Transparency
[MODIFY] 
puzzle_session/components/PuzzlePiece.tsx
Opacity: Change the opacity formula. Instead of dropping to ~0.15, keep the minimum opacity higher (e.g., 0.8 or 1.0) and use saturation changes instead.
Color: Ensure the linear-gradient uses the exact hex codes from 
constants/colors.ts
.
4. Layout & Integration (Phase 2)
[MOVE] Puzzle Components
Move puzzle_session/components/* to components/puzzle/*.
Update imports and paths.
[MODIFY] 
App.tsx
Ensure PuzzleSessionView is correctly instantiated with the new component paths.
Verification Plan
Manual Verification
Mascot: Check if the bubble tail points exactly to the mascot.
Center Card: Verify text is readable and prominent.
Colors: Verify puzzle pieces are vibrant and opaque, matching the Figma palette.
Navigation: Verify switching between Canvas and Puzzle works (already implemented but check after moves).