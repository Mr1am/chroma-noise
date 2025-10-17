/**
 * Represents a color position in 2D space.
 */
export interface Point {
	/** Color of the point in hex format, e.g. "#FF0000" */
	color: string;
	/** X coordinate of the point (0 to 1) */
	x: number;
	/** Y coordinate of the point (0 to 1) */
	y: number;
}

/**
 * Configuration for warp effect.
 */
export interface Warp {
	/** Warp mode, default: 0 */
	mode?: number;
	/** Warp amount, default: 0 (if 0, warp is not applied) */
	amount?: number;
	/** Warp size, default: 1 */
	size?: number;
}

/**
 * Configuration for grain effect.
 */
export interface Grain {
	/** Grain intensity, default: 0 */
	amount?: number;
	/** Grain size, default: 1 */
	size?: number;
}

/**
 * Configuration for the gradient.
 */
export interface GradientOptions {
	/** Array of color positions */
	points?: Point[];
	/** Maximum number of points */
	maxPoints?: number;
	/** Blend radius, default: 0.6 */
	radius?: number;
	/** Blend intensity, default: 1 */
	intensity?: number;
	/** Warp effect configuration */
	warp?: Warp;
	/** Warp animation speed, default: 1 */
	speed?: number;
	/** Seed for warp effect, default: random */
	seed?: number;
	/** Grain effect configuration */
	grain?: Grain;
}