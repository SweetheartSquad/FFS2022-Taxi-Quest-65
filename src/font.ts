import type { ITextStyle } from 'pixi.js';

export const fontDialogue: Partial<ITextStyle> = {
	fontFamily: 'font',
	fontSize: 18,
	fill: 0x262645,
	align: 'left',
	lineHeight: 20,
	letterSpacing: 0,
	padding: 2,
};
export const fontChoice: Partial<ITextStyle> = {
	...fontDialogue,
	fill: 0xe0e0e8,
};
export const fontPrompt: Partial<ITextStyle> = {
	...fontDialogue,
	fill: 0xe0e0e8,
	dropShadow: true,
	dropShadowDistance: 0,
	stroke: 0x262645,
	strokeThickness: 4,
	lineJoin: 'round',
};
export const fontIngame: Partial<ITextStyle> = {
	...fontChoice,
	fontSize: 48,
};
