// Colours and spacing of connections on the canvas (verbeterronde 005, punt 4). Every answer letter
// has a fixed colour, also for its label; the letter itself always stays visible, so colour is
// never the only signal. Connections of a video step are neutral. Literal colours, because SVG
// arrow heads do not read CSS variables.
export const ANSWER_COLOURS = ['#2f6fd6', '#8b5cf6', '#0f8a7e', '#c2417a']
export const NEUTRAL_COLOUR = '#9aa1a9'

/** The colour of the connection of answer `index` (0 = A), or neutral for a video step (null). */
export const edgeColour = (index) => (index === null || index === undefined ? NEUTRAL_COLOUR : ANSWER_COLOURS[index % ANSWER_COLOURS.length])

/** Space between connections that end at the same step, so they do not lie on top of each other. */
export const LANE_GAP = 16

/** Offsets for `count` connections into one step: spread around 0, e.g. 3 → [-16, 0, 16]. */
export const laneOffsets = (count) => Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * LANE_GAP)
