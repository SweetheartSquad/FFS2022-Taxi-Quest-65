import {
	Container,
	DisplayObject,
	Graphics,
	MIPMAP_MODES,
	SCALE_MODES,
} from 'pixi.js';
import {
	Camera as Camera3D,
	Mesh3D,
	Quat,
	StandardMaterial,
	StandardMaterialAlphaMode,
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
import { lerp, tex } from './utils';

function depthCompare(a: DisplayObject, b: DisplayObject): number {
	return a.y - b.y;
}

export class GameScene extends GameObject {
	container = new Container();

	container3d = new Container();

	graphics = new Graphics();

	camera = new Camera();

	camera3d: Camera3D;

	dialogue: UIDialogue;

	strand: StrandE;

	border: Border;

	passenger: Mesh3D;

	pointDialogue: Mesh3D;

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

		const matPassenger = new StandardMaterial();
		matPassenger.baseColorTexture = tex('palette');
		matPassenger.unlit = true;
		matPassenger.alphaMode = StandardMaterialAlphaMode.blend;
		this.passenger = Mesh3D.createQuad(matPassenger);
		matPassenger.baseColorTexture = tex('passenger');
		matPassenger.baseColorTexture.baseTexture.mipmap = MIPMAP_MODES.ON;
		matPassenger.baseColorTexture.baseTexture.scaleMode = SCALE_MODES.LINEAR;

		this.pointDialogue = Mesh3D.createCube();
		this.pointDialogue.position.set(-9.5, 4.4, 7.1);
		this.pointDialogue.position.z -= 1;
		this.pointDialogue.position.y += 4;
		this.pointDialogue.visible = false;

		this.camera3d = Camera3D.main;
		this.camera3d.y = 7;
		this.camera3d.position.set(1.475, 9.508, 4.506);
		this.passenger.position.set(-9.5, 4.4, 7.1);
		this.passenger.scale.set(8, 8, 8);
		this.passenger.rotationQuaternion.setEulerAngles(0, 90, 0);

		let x = 0;
		let y = 10;
		this.scripts.push(
			new Updater(this, () => {
				const input = getInput();
				x += input.look.x;
				y += input.look.y;
				if (x < -130) {
					x = lerp(x, -130, 0.1);
				} else if (x > 130) {
					x = lerp(x, 130, 0.1);
				}
				if (y < -70) {
					y = lerp(y, -70, 0.1);
				} else if (y > 70) {
					y = lerp(y, 70, 0.1);
				}
				this.camera3d.rotationQuaternion.array = Quat.fromEuler(y, -x, 0);
			})
		);

		this.container3d.addChild(this.passenger);
		this.container3d.addChild(this.pointDialogue);

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
