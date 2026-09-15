import type { NoticeType } from '../types.js';

type Shape = readonly [tag: 'circle' | 'line' | 'path' | 'polyline', attributes: Readonly<Record<string, string>>];

interface IconDefinition {
	readonly strokeWidth: string;
	readonly shapes: readonly Shape[];
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const CROSS: readonly Shape[] = [
	['line', { x1: '18', y1: '6', x2: '6', y2: '18' }],
	['line', { x1: '6', y1: '6', x2: '18', y2: '18' }],
];

const ICONS: Readonly<Record<NoticeType | 'close', IconDefinition>> = {
	info: {
		strokeWidth: '2.5',
		shapes: [
			['circle', { cx: '12', cy: '12', r: '10' }],
			['line', { x1: '12', y1: '16', x2: '12', y2: '12' }],
			['line', { x1: '12', y1: '8', x2: '12.01', y2: '8' }],
		],
	},
	success: {
		strokeWidth: '3',
		shapes: [['polyline', { points: '20 6 9 17 4 12' }]],
	},
	warning: {
		strokeWidth: '2.5',
		shapes: [
			['path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }],
			['line', { x1: '12', y1: '9', x2: '12', y2: '13' }],
			['line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }],
		],
	},
	error: {
		strokeWidth: '3',
		shapes: CROSS,
	},
	confirm: {
		strokeWidth: '2.5',
		shapes: [
			['circle', { cx: '12', cy: '12', r: '10' }],
			['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
			['line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }],
		],
	},
	loading: {
		strokeWidth: '2.5',
		shapes: [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }]],
	},
	close: {
		strokeWidth: '2.5',
		shapes: CROSS,
	},
};

export type IconName = keyof typeof ICONS;

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Readonly<Record<string, string>>): SVGElementTagNameMap[K] {
	const node = document.createElementNS(SVG_NAMESPACE, tag);
	for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
	return node;
}

export function createIcon(name: IconName): SVGSVGElement {
	const { strokeWidth, shapes } = ICONS[name];
	const svg = svgElement('svg', {
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': strokeWidth,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'aria-hidden': 'true',
		focusable: 'false',
	});
	for (const [tag, attributes] of shapes) svg.append(svgElement(tag, attributes));
	return svg;
}
