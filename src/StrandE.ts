/* eslint-disable class-methods-use-this */
import ease from 'eases';
import { Text, TextStyle } from 'pixi.js';
import Strand from 'strand-core';
import { music, sfx } from './Audio';
import { fontIngame } from './font';
import { GameObject } from './GameObject';
import { GameScene } from './GameScene';
import { setScene } from './main';
import { Model } from './Model';
import { Prompt } from './prompt';
import { Prop } from './Prop';
import { Display } from './Scripts/Display';
import { Transform } from './Scripts/Transform';
import { Updater } from './Scripts/Updater';
import { TweenManager } from './Tweens';
import { chunks, delay, removeFromArray, shuffle } from './utils';

let autolink = 0;
const promptDefault = ' ';
export class StrandE extends Strand {
	public scene!: GameScene;

	public debug?: boolean;

	public gameObject?: GameObject;

	public voice?: string;

	ease = ease;

	delay = delay;

	setSource(src: string) {
		autolink = 0;
		super.setSource(
			src
				// replacer link sugar
				.replace(
					/\[{2}(.*?)>(.*?)\]{2}/gm,
					// @ts-ignore
					(_: never, label: string, target: string) =>
						`[[${label || promptDefault}|this.goto(\`${target}\`)]]`
				)
				// auto link sugar
				.replace(
					/^>(.*)/gm,
					// @ts-ignore
					(_: never, link: string) =>
						link === '>'
							? `>${link}`
							: link
									.split('|')
									.map(
										(l) =>
											`[[${l || promptDefault}|this.goto('auto-${
												autolink + 1
											}')]]`
									)
									.concat(`\n::auto-${++autolink}`)
									.join('\n')
				)
				// auto link escape
				.replace(/^\\>/gm, '>')
				// voice sugar
				.replace(
					/^voice(\w+)$/gm,
					// @ts-ignore
					(_: never, voice: string) => `<<do this.voice='${voice}'>>`
				)
		);

		// create passage select for debugging purposes
		const passages = Object.keys(this.passages)
			.filter((i) => !i.match(/\d/))
			.map((i) => `[[${i}]]`);
		const pages = chunks(passages, 15);
		pages.forEach((i, idx) => {
			if (pages.length > 1) {
				i.push(`[[passage select ${(idx + 1) % pages.length}]]`);
			}
			i.push('[[back|this.back()]]');
			this.passages[`passage select ${idx}`] = {
				title: `passage select ${idx}`,
				body: i.join('\n'),
			};
		});
		this.passages['passage select'] = this.passages['passage select 0'];
	}

	show(...args: Parameters<typeof this.scene['dialogue']['show']>) {
		return this.scene.dialogue.show(...args);
	}

	tween(...args: Parameters<typeof TweenManager['tween']>) {
		// @ts-ignore
		return TweenManager.tween(...args);
	}

	tweenFinish = TweenManager.finish;

	tweenAbort = TweenManager.abort;

	shuffle(...args: Parameters<typeof shuffle>) {
		return shuffle(...args);
	}

	scrim(...args: Parameters<typeof this.scene['scrim']['scrim']>) {
		this.scene.scrim.scrim(...args);
	}

	sfx(...args: Parameters<typeof sfx>) {
		return sfx(...args);
	}

	music(...args: Parameters<typeof music>) {
		return music(...args);
	}

	destroy(gameObject: GameObject) {
		gameObject.destroy();
	}

	restart() {
		const newScene = new GameScene();
		setScene(newScene);
	}

	end() {
		setScene();
	}

	Prop(...args: ConstructorParameters<typeof Prop>) {
		return new Prop(...args);
	}

	Model(...args: ConstructorParameters<typeof Model>) {
		const model = new Model(...args);
		this.scene.container3d.addChildAt(model.model, 1);
		return model;
	}

	InteractionRegion(region: typeof this.scene['interactionRegions'][number]) {
		this.scene.interactionRegions.push(region);
		return () => {
			removeFromArray(this.scene.interactionRegions, region);
		};
	}

	Updater(cb: ConstructorParameters<typeof Updater>[1]) {
		const updater = new Updater(this.scene, cb);
		this.scene.scripts.push(updater);
		return () => {
			removeFromArray(this.scene.scripts, updater);
			updater.destroy?.();
		};
	}

	Text(
		str: string,
		{
			x = 0,
			y = 0,
			offset = 0,
			font,
		}: {
			x?: number;
			y?: number;
			font?: Partial<TextStyle>;
			offset?: number;
		} = {}
	) {
		const go = new GameObject();
		const transform = new Transform(go);
		go.scripts.push(transform);
		const display = new Display(go);
		go.scripts.push(display);
		const text = new Text(str, { ...fontIngame, ...font });
		display.container.addChild(text);
		display.container.x = transform.x = x;
		display.container.y = transform.y = y + offset;
		text.y -= offset;
		// @ts-ignore
		go.display = display;
		// @ts-ignore
		go.transform = transform;
		// @ts-ignore
		go.text = text;
		return go;
	}

	async prompt(options: ConstructorParameters<typeof Prompt>[2]) {
		this.scene.dialogue.complete();
		await new Promise<void>((r) => {
			const check = () => {
				if (!this.busy) {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							r();
						});
					});
					return;
				}
				requestAnimationFrame(check);
			};
			check();
		});
		this.scene.dialogue.textText.text = `${options?.defaultValue || ''}_`;
		return new Promise<string>((resolve) => {
			let value = options?.defaultValue || '';
			const p = new Prompt(
				(v) => {
					value = v;
					sfx('button');

					const highlight =
						(p.elInput.selectionEnd || 0) - (p.elInput.selectionStart || 0);
					let str = p.elInput.value;
					// insert caret/replace highlighted text
					str = `${str.substring(0, p.elInput.selectionStart || 0)}${
						highlight > 0 ? '| '.repeat(highlight) : '_'
					}${str.substring(p.elInput.selectionEnd || 0)}`;

					this.scene.dialogue.textText.text = str;
				},
				() => {
					resolve(value);
				},
				options
			);
		});
	}
}
