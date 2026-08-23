# Historical Night Sky Generator

## Purpose

Generate a realistic, consistent visual reconstruction of the night sky for a
user-specified date and location, matching the established panoramic
night-sky style.

## Trigger

Use this skill when the user provides or requests:

- A historical or future date + location and asks to see the night sky.
- "Show me the night sky on…"
- "Generate the same for…"
- A follow-up containing only a new date/location after a night-sky image has
  already been generated.

## Inputs

### Required

- `date`
- `location`

### Optional

- `time` — default to 00:00 local time
- `view_direction` — default to South
- Exact coordinates
- Desired visual style

Resolve the location to appropriate latitude/longitude when possible.

## Important Accuracy Rule

The generated image is a visual reconstruction, not an astronomical
calculation.

When astronomical accuracy matters, first determine the actual sky
configuration for the requested date, time, and coordinates using reliable
astronomical data. Do not invent the Moon's phase, position, planets,
constellations, or Milky Way orientation.

If no astronomical calculation/source is available, generate an illustrative
reconstruction and avoid claiming that individual celestial positions are
exact.

## Image Specification

Generate a wide 16:9 photorealistic astrophotography panorama.

The composition should contain:

- Dark blue/black natural night sky
- Realistic star field
- Milky Way only where appropriate
- Moon with the correct phase when known
- Major bright stars/planets where known
- Low horizon representing the requested location
- Historically appropriate level of urban development where practical
- Natural atmospheric haze/light pollution appropriate to the location and era

Avoid exaggerated fantasy colors, oversized celestial objects, artificial
nebulae, or unrealistic star density.

## Information Overlay

Place clean white text in the upper-left:

```
Night Sky on [DATE]

Date: [DATE]
Time: [TIME] Local Time
Location: [CITY/REGION, COUNTRY]
Coordinates: [LATITUDE], [LONGITUDE]

View: Facing [DIRECTION]
```

At the bottom, include a subtle compass/navigation strip appropriate to the
selected direction.

For a south-facing view:

```
SE — S — SW
```

## Visual Style

Maintain consistency across generations:

- Photorealistic astrophotography
- Wide cinematic panorama
- Large unobstructed sky
- Horizon occupying roughly the lowest 10–15%
- Moon rendered at a believable apparent scale
- Minimal, elegant informational typography
- No decorative borders
- No unnecessary labels over individual stars
- No people unless explicitly requested

## Location Treatment

Adapt the horizon to the requested place and historical period.

Examples:

### Gurgaon/Gurugram, India

- Flat northern Indian landscape
- Appropriate urbanization for the requested year
- Modern skyline only for recent dates
- Much darker and less developed horizon for dates such as the 1980s or 1990s

### Al Ain, UAE

- Desert environment
- Palm silhouettes
- Low mountains/hills where geographically appropriate
- Urban lighting appropriate to the requested year

Do not depict a present-day skyline for a historical date unless explicitly
requested.

## Follow-Up Behavior

Preserve unspecified parameters from the previous generation.

Example:

User:
"1 Feb 1995 Gurgaon"

Interpret as:

- Date: 1 February 1995
- Location: Gurgaon, Haryana, India
- Time: 00:00 local
- Direction: South
- Same established visual style

Then generate the image directly without asking for confirmation.

If the user subsequently says:

"3 Nov 1990 Haryana"

update only the date/location while preserving the established defaults.

## Generation Prompt Pattern

Create a wide 16:9 photorealistic astrophotography reconstruction of the
night sky as viewed from [LOCATION] on [DATE] at [TIME LOCAL], facing
[DIRECTION].

Use the geographically appropriate horizon and historically appropriate urban
development for that location and year.

Represent the Moon's phase and celestial configuration accurately when
astronomical information is available. Keep celestial objects at believable
apparent sizes.

Add a clean informational overlay in the upper-left containing the date,
local time, location, coordinates, and viewing direction.

Add a subtle compass strip along the bottom.

The result should resemble a high-quality planetarium reconstruction blended
with realistic landscape astrophotography rather than fantasy space art.
