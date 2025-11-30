# UI Refinement Plan - Puzzle AI

**Created**: 2025-11-30
**Status**: Planning / Ready for Implementation

---

## Overview

This document outlines all UI/UX issues identified from comparing the current implementation against Figma reference designs and specifications.

### Reference Files
- `Figma/colors/ColorPallate.png` - Official color palette
- `Figma/mascot/MascotSpecs.png` - Mascot speech bubble design specs
- `Figma/PuzzleStages/*.png` - Puzzle session UI reference
- `SystemDoc.md` - Product specifications

---

## 1. Critical Issues

### 1.1 QuadrantSpawner (Hub) Redesign - HIGH PRIORITY

**Current Problems:**
- White background with Plus (+) icon
- Label appears BELOW the box as separate text
- Colors are transparent/faded
- Positioned at edges, not corners

**Expected Design (from Figma):**
- Solid colored rounded rectangle buttons
- Label text ("Form", "Motion", etc.) INSIDE the button
- 100% opacity on button colors
- Corners position: top-left (Form), top-right (Motion), bottom-left (Expression), bottom-right (Function)

**Required Changes:**
```typescript
// QuadrantSpawner.tsx
// Change from: white bg + Plus icon + external label
// Change to: colored bg with label inside

// Colors (from ColorPallate.png Row 3-4 for buttons):
FORM: '#5E5BFF' → blue  // Wait, looking at Figma reference, Form is Blue top-left
MOTION: '#00DE8C' → green // Motion is Green top-right
EXPRESSION: '#8E34FE' → purple // Expression is Purple bottom-left
FUNCTION: '#FB07AA' → pink // Function is Pink bottom-right
```

**File**: `components/puzzle/QuadrantSpawner.tsx`

---

### 1.2 Color Gradient System - HIGH PRIORITY

**Current Problems:**
- Pieces don't show proper saturation gradient from center to edge
- Using opacity changes instead of saturation/lightness changes
- Colors appear washed out/transparent

**Expected Design (from ColorPallate.png):**
- Pieces NEAR center: Full saturation (Row 3-4 colors)
- Pieces FAR from center: Lower saturation, higher brightness (Row 1-2 colors)
- NO opacity changes - always 100% opaque

**Color Gradient Map:**
```
Distance 0-1 (center):  Row 4 colors (most saturated)
  FORM: #5E5BFF, MOTION: #00A650, EXPRESSION: #923CFF, FUNCTION: #FB07AA

Distance 2-3 (mid):     Row 3 colors
  FORM: #7496E9, MOTION: #00DE8C, EXPRESSION: #B4ABFA, FUNCTION: #FE93F1

Distance 4-5 (far):     Row 2 colors
  FORM: #87BEF7, MOTION: #C9F9DF, EXPRESSION: #C4ADFD, FUNCTION: #FFB5FA

Distance 6+ (edge):     Row 1 colors (lightest)
  FORM: #C0E5EB, MOTION: #E0DEF8, EXPRESSION: #E0DEF8, FUNCTION: #FFD5FF
```

**Files**:
- `components/puzzle/PuzzlePiece.tsx`
- `constants/colors.ts`

---

### 1.3 CenterCard Visibility - HIGH PRIORITY

**Current Problems:**
- Too small at 2x2 grid cells (128x128px)
- Text is hard to read
- Inner grid pattern is distracting
- Process aim text truncated poorly

**Expected Design:**
- Larger card (3x3 or 4x3 grid cells)
- Prominent white text on dark (#111827) background
- No inner grid pattern
- Clear typography with good contrast
- Rounded corners (16-20px radius)

**File**: `components/puzzle/CenterCard.tsx`, `constants/puzzleGrid.ts`

---

### 1.4 Mascot Speech Bubble - MEDIUM PRIORITY

**Current Problems (MascotSpecs.png comparison):**
- Wrong background color (white instead of #FFB5FA pink)
- Wrong text color (gray instead of #1C1C1C)
- Bubble not vertically centered with mascot
- Style doesn't match blocky/pixel-wise mascot character

**Expected Design (from MascotSpecs.png):**
```
Speech Bubble Content:
- Color: #1C1C1C, 100% Opacity
- Font size: 14
- Font: SF Pro Display (or system font fallback)
- Font weight: Heavy (700-800)
- Line spacing: 18
- Character spacing: 0%
- Background color: #FFB5FA, 100% Opacity
```

**Layout:**
- Mascot and speech bubble are vertically centered
- Bubble appears to the right of mascot
- Sharp/pixel-wise corners to match mascot style

**Files**:
- `components/mascot/MascotButton.tsx` (home canvas)
- `components/puzzle/Mascot.tsx` (puzzle session)

---

## 2. Layout Issues

### 2.1 Spawner Positioning

**Current**: `top-1/4 left-12`, `top-1/4 right-12`, etc.

**Expected (from Figma):**
- Form: Top-left corner, closer to corner
- Motion: Top-right corner
- Expression: Bottom-left corner
- Function: Bottom-right corner

**Suggested CSS:**
```css
Form:       top-20 left-6
Motion:     top-20 right-6
Expression: bottom-20 left-6
Function:   bottom-20 right-6
```

---

### 2.2 Hub Button Style

**Current**: White box with Plus icon, 64x64px

**Expected (from Figma):**
- Rounded rectangle with solid quadrant color
- Text label inside: "Form", "Motion", "Expression", "Function"
- White text on colored background
- Larger touch target (~80x40px rounded pill shape)

---

## 3. Color Corrections

### 3.1 Quadrant Primary Colors

Cross-referencing ColorPallate.png with Figma designs:

| Quadrant | Current | Correct (Row 4) | Note |
|----------|---------|-----------------|------|
| FORM | #5E5BFF | #5E5BFF | Blue - correct |
| MOTION | #00DE8C | #00DE8C | Green - correct |
| EXPRESSION | #8E34FE | #923CFF | Purple - update needed |
| FUNCTION | #FB07AA | #FB07AA | Pink - correct |

### 3.2 System Colors

| Element | Current | Correct |
|---------|---------|---------|
| Center Card BG | #111827 | #111827 (correct) |
| Speech Bubble BG | white | #FFB5FA |
| Speech Bubble Text | gray-700 | #1C1C1C |

---

## 4. Implementation Checklist

### Phase A: Color & Gradient System
- [ ] Update `constants/colors.ts` with correct palette rows
- [ ] Implement `getGradientColorByDistance()` function using saturation/lightness
- [ ] Remove opacity-based fading from PuzzlePiece
- [ ] Apply gradient colors to pieces based on distance

### Phase B: Hub Redesign
- [ ] Redesign QuadrantSpawner as colored pill buttons
- [ ] Move label text INSIDE the button
- [ ] Update positioning to true corners
- [ ] Remove Plus icon, use text only

### Phase C: CenterCard Enhancement
- [ ] Increase size to 3x3 or 4x3 grid units
- [ ] Remove inner grid pattern
- [ ] Improve typography (larger font, better weight)
- [ ] Ensure high contrast readability

### Phase D: Mascot Alignment
- [ ] Update speech bubble background to #FFB5FA
- [ ] Update text color to #1C1C1C
- [ ] Vertically center bubble with mascot
- [ ] Add pixel-wise styling (sharper corners)

### Phase E: Testing
- [ ] Visual comparison with Figma references
- [ ] Test gradient colors at various distances
- [ ] Verify spawner drag-to-create still works
- [ ] Test on different screen sizes

---

## 5. File Change Summary

| File | Changes |
|------|---------|
| `constants/colors.ts` | Add gradient palette, fix EXPRESSION color |
| `constants/puzzleGrid.ts` | Increase CENTER_CARD dimensions |
| `components/puzzle/QuadrantSpawner.tsx` | Complete redesign to colored pill buttons |
| `components/puzzle/PuzzlePiece.tsx` | Use saturation gradient instead of opacity |
| `components/puzzle/CenterCard.tsx` | Larger size, better typography |
| `components/puzzle/Board.tsx` | Update spawner positions |
| `components/puzzle/Mascot.tsx` | Pink bubble, centered alignment |
| `components/mascot/MascotButton.tsx` | Pink bubble style |

---

## 6. Reference Images Summary

### ColorPallate.png Key Colors:
```
Green Column (FORM/MOTION depending on quadrant):
  Row 1: #C9F9DF  Row 2: #00DE8C  Row 3: #00A650  Row 4: #169B2F
  Row 5: #465F43  Row 6: #0A6439  Row 7: #193E18

Blue Column:
  Row 1: #C0E5EB  Row 2: #87BEF7  Row 3: #7496E9  Row 4: #5E5BFF
  Row 5: #5354ED  Row 6: #3544E0  Row 7: #1244C5

Purple Column (EXPRESSION):
  Row 1: #E0DEF8  Row 2: #C4ADFD  Row 3: #B4ABFA  Row 4: #746DD8
  Row 5: #923CFF  Row 6: #8E34FE  Row 7: #532ACC

Pink Column (FUNCTION):
  Row 1: #FFD5FF  Row 2: #FFB5FA  Row 3: #FEA1E6  Row 4: #FE93F1
  Row 5: #FB07AA  Row 6: #E91D26  Row 7: #AF0C21
```

### MascotSpecs.png Key Values:
- Bubble BG: #FFB5FA
- Text Color: #1C1C1C
- Font Size: 14px
- Font Weight: Heavy
- Alignment: Vertically centered with mascot

---

**Document Version**: 1.0
**Ready for Codex Implementation**: Yes
