<script lang="ts">
	import { Button } from 'ventoui-button';
	import { Slider } from 'ventoui-slider';
	import { slide } from 'svelte/transition';

	interface Props {
		points?: { color: string; x: number; y: number }[];
		radius?: number;
		intensity?: number;
		timeAmount?: number;
		warpMode?: number;
		warpSize?: number;
		warpAmount?: number;
		grainAmount?: number;
		grainSize?: number;
		grainAnimate?: boolean;
		seed?: number;
		handlers?: boolean;
		options?: (option: any) => void;
		children?: import('svelte').Snippet;
	}

	let {
		points = $bindable([]),
		radius = 0.6,
		intensity = 1.0,
		timeAmount = 1.0,
		warpMode = $bindable(0),
		warpSize = 1.0,
		warpAmount = 0.0,
		grainAmount = 0.0,
		grainSize = 1.0,
		handlers = $bindable(true),
		options = ({}) => {},
		seed = Math.random(),
		children
	}: Props = $props();

	function addPoint() {
		if (points.length >= 12) return;
		points = [...points, { color: '#ffffff', x: 0.5, y: 0.5 }];
	}
	function removePoint(i: number) {
		points = points.filter((_, idx) => idx !== i);
	}
	function updatePoint(i: number, partial: Partial<(typeof points)[0]>) {
		points = points.map((p, idx) => (idx === i ? { ...p, ...partial } : p));
	}

	$effect(() => options({ radius }));
	$effect(() => options({ intensity }));
	$effect(() => options({ warpSize }));
	$effect(() => options({ warpAmount }));
	$effect(() => options({ seed }));
	$effect(() => options({ timeAmount }));
	$effect(() => options({ grainAmount }));
	$effect(() => options({ grainSize }));
	function randomizeSeed() {
		const s = Math.random();
		options({ seed: s });
	}
</script>

<aside class="sidebar">
	<h1>Colors</h1>
	<div class="colors">
		{#each points as point, i}
			<div class="point-row" transition:slide|global={{ axis: 'x' }}>
				<input
					class="color-input"
					type="color"
					bind:value={point.color}
					oninput={(e) => updatePoint(i, { color: e.target.value })}
				/>
				<button class="remove-btn centered" onclick={() => removePoint(i)}>✕</button>
			</div>
		{/each}
		<Button glare class="add-btn centered s-inline width-fit radius-large" onclick={addPoint}>+</Button>
	</div>
	<h1>Blend</h1>
	<Slider label={`Radius: ${radius.toFixed(2)}`} min={0.01} max={2} step={0.01} bind:value={radius}
	></Slider>
	<Slider
		label={`Intensity: ${intensity.toFixed(2)}`}
		min={0.01}
		max={3}
		step={0.01}
		bind:value={intensity}
	></Slider>
	<h1>Warp</h1>
	<div class="horizontal gap-xs">
		<p>Mode</p>
		<select class="plain width-fill radius-large" bind:value={warpMode}>
			<option value="0">None</option>
			<option value="1">Waves</option>
			<option value="2">Simplex Noise</option>
			<option value="3">FBM (fractal)</option>
			<option value="4">Ridged</option>
			<option value="5">Swirl</option>
			<option value="6">Radial waves</option>
		</select>
	</div>

	<Slider
		label={`Size: ${warpSize.toFixed(2)}`}
		min={0.05}
		max={10}
		step={0.05}
		bind:value={warpSize}
	></Slider>
	<Slider
		label={`Amount: ${warpAmount.toFixed(2)}`}
		min={0}
		max={2}
		step={0.01}
		bind:value={warpAmount}
	></Slider>

	<div class="horizontal gap-xs center">
		<p>Seed:</p>
		<input
			class="width-fill s sec radius-large"
			type="number"
			min="0"
			max="1"
			step="0.001"
			bind:value={seed}
		/>
		<Button
			glare
			class="centered radius-large s width-fit"
			onclick={randomizeSeed}>Random</Button>
	</div>

	<h1>Animation</h1>
	<Slider
		label={`Speed: ${timeAmount.toFixed(2)}`}
		min={0}
		max={5}
		step={0.01}
		bind:value={timeAmount}
	></Slider>

	<h1>Grain</h1>
	<Slider
		label={`Amount: ${grainAmount.toFixed(2)}`}
		min={0}
		max={0.25}
		step={0.005}
		bind:value={grainAmount}
	></Slider>
	<Slider label={`Size: ${grainSize.toFixed(2)}`} min={0} max={20} step={0.1} bind:value={grainSize}
	></Slider>

	<h1>Color handlers</h1>
	<div class="horizontal gap-xs start">
		<p>Show</p>
		<input type="checkbox" class="height-fill" bind:checked={handlers} />
	</div>
	{@render children?.()}
</aside>

<style>
	h1,
	p {
		text-align: left;
	}
	h1 {
		margin-top: var(--s);
		font-size: 1.1rem;
	}
	.colors {
		display: flex;
		overflow: scroll hidden;
		scrollbar-width: thin;
		padding-bottom: var(--xs);
		gap: 0.25rem;
		min-height: 4rem;
	}
	.centered {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sidebar {
		width: 320px;
		padding: 18px;
		box-sizing: border-box;
		background: #111;
		color: #ddd;
		overflow: hidden scroll;
		gap: var(--s);
		display: flex;
		flex-direction: column;
		touch-action: auto;
	}

	.sidebar * {
		touch-action: auto;
	}
	.point-row {
		display: flex;
		align-items: center;
		position: relative;
		padding: 0.25rem;
		font-size: 0.6rem;
	}
	.color-input {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 1rem;
		border: none;
		background: none;
	}
	.remove-btn {
		background: #222;
		border: none;
		color: #fff;
		border-radius: 2rem;
		cursor: pointer;
		position: absolute;
		right: 0;
		top: 0;
		width: 1.2rem;
		height: 1.2rem;
	}

	input[type='color']::-webkit-color-swatch {
		border: none;
		padding: 0;
		margin: -0.5rem;
	}

	p {
		padding-block: 0.5rem;
	}

	select {
		background: var(--bg);
	}

	@media screen and (width < 640px) {
		.sidebar {
			width: 100vw;
			height: 35dvh;
		}
	}
</style>
