<script>
	let { children, ...rest } = $props();
</script>

<section {...rest}>
	{@render children?.()}
</section>

<style>
	section {
		background: var(--fg-tint);
		border-radius: 1rem;
		padding: 1rem;
		touch-action: auto;
	}
</style>