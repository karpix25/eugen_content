# Carousel Strategic Planner Skill

## Overview
This skill defines the requirements for generating high-fidelity, corporate-grade carousel content for premium audiences. It focuses on strategic storytelling and pixel-perfect design consistency.

## Narrative Rules (The "Anti-Cheap" Framework)
1. **No Navigation Cues**: Prohibit the AI from writing "Что дальше?", "Next slide", or using ➡️ emojis. The flow should be narrative, not navigational.
2. **The "So What?" Rule**: Every slide must address the implication for a business leader.
3. **Internal Hooks**: Every slide must end with a conceptual "cliffhanger" or semantic bridge that pulls the user into the next slide.
4. **Expert Density**: Body text should be dense and informative (~25 words), avoiding primitive summaries.

## Design Rules (UI Fidelity)
1. **Full Interface Consistency**: For UI-based styles (like iOS Notes), **every single slide** must feature the full interface (e.g., top header with 'Done' button, bottom menu icons). 
2. **Visual Narrative Alignment**: Visual cues like highlights or bold headers should reflect the "Strategic Pivot" phase of the current slide.

## Prompt Phase Structure (CoT)
1. **Mining**: Identify the "Diamond Insight" in the source content.
2. **Triggering**: Select a psychological trigger (Impossible Result, Expensive Mistake, Secret Framework, Industry Lie).
3. **Mapping**: Outline the logical bridge between all 6 slides before scripting.
4. **Action**: Final script generation with strict word and character limits.
