# Uniform render audit — 2026-10-06

## Verified coverage

- 458 CAP membership/cut/authorized-uniform/rank combinations loaded in Chromium.
- 2,872 option cases: each membership-eligible CAP badge, each uniform-authorized patch, and basic/maximum bulk award selection, across representative officer ranks and both cuts.
- Zero page errors, broken base images, or broken rendered option images in the completed matrix.
- 134 automated tests passed. Military browser smoke checks passed after updating stale asset/catalog expectations.
- Sample images show Class A, Class B, and OCP with selected awards/badges for both cuts. These were visually inspected; the officer OCP tape-clearance and female sleeve defaults were then corrected and samples rerendered.

This is systematic base and individual-option coverage, not enumeration of the exponential product of every badge, award quantity, device, calibration, and patch selection. A missing item omitted by authorization or explicit availability rules is not counted as a broken image. Passing image-load checks does not establish uniform-regulation compliance.

## Fixes

- Global image retries now preserve the renderer's recovery callback, including when retries are reinstalled. Exhausted rank-specific jacket candidates recover to a generic garment instead of leaving a broken image.
- Base-load completion refreshes validation, allowing missing rank-specific artwork to be reported after asynchronous loading.
- Bulk CAP military-ribbon selection skips catalog records without available ribbon artwork.
- Legacy Communications patch uses the existing `comms_patch.png` artwork.
- Missing Aerospace Education patch artwork is explicitly identified and omitted from rendering, and disabled in the applicable picker.
- Female OCP sleeve sprites receive the same 200 × 100 geometry and sleeve origin as the shared male artwork.
- Default badge clearance for illustrated senior-officer OCP bases uses the actual tape top at y=156 instead of the photographic fallback's y=180. Saved positions retain precedence.
- Browser smoke tests run against repository files using Playwright routing, without requiring an HTTP server, and accept both reviewed precomposed ribbons and runtime PNG compositions.

## Remaining artwork limitations

- Aviator + Blazer, Corporate Field, Flight Suit, and Polo use substitute white-shirt bases. Their actual garment silhouettes are absent from the repository; warnings now identify these incomplete previews.
- Some rank-specific bases are absent. Generic fallback artwork can omit the chosen grade or include an unrelated baked-in grade. A load-success result does not mean the grade artwork is correct.
- Senior officer Class A sources contain gray epaulet insignia floating above the coat shoulders. These are embedded in the source PNGs and need corrected source artwork; moving other layers cannot fix them reliably.
- Aerospace Education patch artwork is absent. No unverified patch design was fabricated.
- Space Force badge records without approved local artwork remain explicit missing records.

Do not describe this audit as completion of all missing uniforms, items, or visual geometry. The fixes above are verified; the artwork limitations remain open.

Reference checked: [CAP uniform regulation and current interim changes](https://www.gocivilairpatrol.com/members/publications/indexes-regulations-and-manuals-1700). No new authorization rules were inferred from product photographs.
