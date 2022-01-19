import type { ITextStyle } from 'pixi.js';

export const fontDialogue: Partial<ITextStyle> = {
	fontFamily: 'font',
	fontSize: 18,
	fill: 0,
	align: 'left',
	lineHeight: 20,
	letterSpacing: 0,
	padding: 2,
	stroke: 0xffffff,
	strokeThickness: 2,
	lineJoin: 'round',
};
export const fontPrompt: Partial<ITextStyle> = {
	fontFamily: 'font',
	fontSize: 8,
	fill: 0xffffff,
	align: 'center',
	lineHeight: 12,
	letterSpacing: 0,
	padding: 2,
	dropShadow: true,
	dropShadowDistance: 0,
	stroke: 0,
	strokeThickness: 2,
	lineJoin: 'round',
};
export const fontIngame: Partial<ITextStyle> = {
	fontFamily: 'font',
	fontSize: 8,
	fill: 0xffffff,
	align: 'center',
	lineHeight: 12,
	letterSpacing: 0,
	padding: 2,
	dropShadow: true,
	dropShadowDistance: 0,
	stroke: 0,
	strokeThickness: 2,
	lineJoin: 'round',
};
