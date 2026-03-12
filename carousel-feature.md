# Carousel Feature Integration Plan

## Goal
Integrate the AI Carousel generation feature into the "Женя" platform, allowing users to generate 6-slide Instagram carousels from video clips using OpenRouter for content and Kie.ai for visual generation.

## Tasks
- [ ] **Database Setup**: Add `carousel_styles` and `carousels` tables to `src/lib/db.ts` → Verify: `initDb` logs success.
- [ ] **OpenRouter Integration**: Create `src/services/openrouter.ts` for professional copywriting and prompt engineering → Verify: Test script returns 6-slide JSON.
- [ ] **Kie.ai Integration**: Create `src/services/kie.ts` to call the image generation API → Verify: Returns a URL for the generated 2x3 grid.
- [ ] **Slicer Logic**: Add `src/services/slicer.ts` using `sharp` to split the grid into 6 slides → Verify: Generates 6 separate image files from a single input.
- [ ] **Carousel Controller**: Create `/api/carousels` endpoints in `server.ts` to orchestrate the generation flow → Verify: `POST /api/carousels/generate` returns slide URLs.
- [ ] **Style Management**: Implement UI and API for saving/loading carousel styles (reference images + analysis) → Verify: User can upload a reference and see its analysis.
- [ ] **UI Integration**: Add "Create Carousel" button to Clip cards and build the generation wizard → Verify: Clicking button opens modal with style selection.

## Done When
- [ ] Users can select a clip and click "Carousel".
- [ ] System generates a 6-slide carousel based on the clip's content.
- [ ] The carousel image is correctly sliced and presented for preview/download.
- [ ] Styles can be saved and reused across different clips.

## Notes
- Use `sharp` for image processing as it's already a dependency in `instacarousel-ai`.
- OpenRouter will use `anthropic/claude-3.5-sonnet` or similar for high-quality copywriting.
- Kie.ai will use `seedream-5.0` or `gemini-3.1-flash-image` as specified in their API docs.
