import type { ITextStyle } from 'pixi.js';

export const fontDialogue: Partial<ITextStyle> = {
	fontFamily: 'font',
	fontSize: 18,
	fill: 0,
	align: 'left',
	lineHeight: 20,
	letterSpacing: 0,
	padding: 2,
};
export const fontChoice: Partial<ITextStyle> = {
	...fontDialogue,
	fill: 0xffffff,
};
export const fontPrompt: Partial<ITextStyle> = {
	...fontDialogue,
	fill: 0xffffff,
	dropShadow: true,
	dropShadowDistance: 0,
	stroke: 0,
	strokeThickness: 4,
	lineJoin: 'round',
};
export const fontIngame: Partial<ITextStyle> = {
	...fontChoice,
	fontSize: 32,
};
