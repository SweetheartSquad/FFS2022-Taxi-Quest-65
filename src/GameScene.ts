import { Container, DisplayObject, Graphics, LoaderResource } from 'pixi.js';
import {
	CameraOrbitControl,
	glTFAsset,
	Light,
	LightingEnvironment,
	Model,
	Sprite3D,
} from 'pixi3d';
import { Border } from './Border';
import { Camera } from './Camera';
import { DEBUG } from './debug';
import { game, resources } from './Game';
import { GameObject } from './GameObject';
import { getInput } from './main';
import { Updater } from './Scripts/Updater';
import { StrandE } from './StrandE';
import { TweenManager } from './Tweens';
import { UIDialogue } from './UIDialogue';
import { tex } from './utils';

function depthCompare(a: DisplayObject, b: DisplayObject): number {
	return a.y - b.y;
}

export class GameScene extends GameObject {
	container = new Container();

	container3d = new Container();

	graphics = new Graphics();

	camera = new Camera();

	dialogue: UIDialogue;

	strand: StrandE;

	border: Border;

	constructor() {
		super();
		this.container.addChildAt(this.graphics, 0);

		this.strand = new StrandE({
			source: resources.main.data,
			renderer: {
				displayPassage: (passage) => {
					if (passage.title === 'close') {
						this.dialogue.close();
						return Promise.resolve();
					}
					const program = this.strand.execute(passage.program);
					if (this.strand.voice) {
						this.dialogue.voice = this.strand.voice;
						delete this.strand.voice;
					}
					const text: string[] = [];
					const actions: (typeof program[number] & {
						name: 'action';
					})['value'][] = [];
					program.forEach((node) => {
						switch (node.name) {
							case 'text':
								text.push(node.value);
								break;
							case 'action':
								actions.push(node.value);
								break;
							default:
								throw new Error('unrecognized node type');
						}
					});
					this.dialogue.say(
						text.join('').trim(),
						actions.map((i) => ({
							text: i.text,
							action: () => this.strand.eval(i.action),
						}))
					);
					return Promise.resolve();
				},
			},
		});
		this.strand.scene = this;
		this.strand.debug = DEBUG;
		this.dialogue = new UIDialogue(this.strand);

		this.border = new Border();
		this.border.init();
		this.border.display.container.alpha = 0;

		this.camera.display.container.addChild(this.container);

		const bus = Model.from(
			(resources.bus as LoaderResource & { gltf: glTFAsset }).gltf
		);
		this.scripts.push(
			new Updater(this, () => {
				// bus.rotationQuaternion.setEulerAngles(0, Date.now() / 25, 0);
			})
		);
		this.container3d.addChild(bus);
		const passenger = new Sprite3D(tex('passenger'));
		this.container3d.addChild(passenger);

		LightingEnvironment.main.lights.push(
			Object.assign(new Light(), { x: -1, z: 3 })
		);

		const control = new CameraOrbitControl(game.app.view);

		game.app.stage.addChild(this.container3d);
		game.app.stage.addChild(this.dialogue.display.container);
		game.app.stage.addChild(this.border.display.container);

		this.strand.history.push('close');
		this.strand.goto('start');
	}

	destroy(): void {
		this.container.destroy({
			children: true,
		});
		super.destroy();
	}

	update(): void {
		if (DEBUG) {
			if (
				this.dialogue.isOpen &&
				this.strand.currentPassage.title === 'debug menu' &&
				getInput().menu
			) {
				this.strand.goto('close');
			} else if (getInput().menu) {
				this.strand.goto('debug menu');
			}
		}

		const curTime = game.app.ticker.lastTime;

		// depth sort
		this.container.children.sort(depthCompare);
		this.container.addChild(this.graphics);

		// adjust camera based on dialogue state
		const p = this.dialogue.progress();
		this.camera.display.container.scale.x =
			this.camera.display.container.scale.y = 1 + p * 0.1;

		const g = this.graphics;

		// test bg
		g.clear();

		const u = this.update;
		// @ts-ignore
		this.update = () => {};
		GameObject.update();
		this.update = u;
		super.update();
		TweenManager.update();
	}
}
