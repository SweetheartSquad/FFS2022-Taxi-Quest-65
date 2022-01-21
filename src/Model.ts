import { LoaderResource, MIPMAP_MODES, SCALE_MODES } from 'pixi.js';
import {
	glTFAsset,
	Model as Pixi3dModel,
	StandardMaterial,
	StandardMaterialAlphaMode,
} from 'pixi3d';
import { resources } from './Game';
import { GameObject } from './GameObject';
import { Animator3d } from './Scripts/Animator3d';
import { tex } from './utils';

export class Model extends GameObject {
	model: Pixi3dModel;

	material: StandardMaterial;

	animator: Animator3d;

	constructor(
		model: string,
		texture: string,
		{
			smooth = false,
			transparent = false,
			doubleSided = false,
		}: { smooth?: boolean; transparent?: boolean; doubleSided?: boolean } = {}
	) {
		super();
		const gltf = (
			resources[model] as Maybe<LoaderResource & { gltf?: glTFAsset }>
		)?.gltf;
		if (!gltf) {
			throw new Error(`unknown model ${model}`);
		}
		this.model = Pixi3dModel.from(gltf);
		this.material = new StandardMaterial();
		this.material.baseColorTexture = tex(texture);
		if (smooth) {
			this.material.baseColorTexture.baseTexture.mipmap = MIPMAP_MODES.ON;
			this.material.baseColorTexture.baseTexture.scaleMode = SCALE_MODES.LINEAR;
		}
		if (transparent) {
			this.material.alphaMode = StandardMaterialAlphaMode.blend;
		}
		this.material.doubleSided = doubleSided;
		this.material.unlit = true;
		this.model.meshes.forEach((mesh) => {
			mesh.material = this.material;
		});
		this.scripts.push(
			(this.animator = new Animator3d(this, { mat: this.material }))
		);
	}

	setAnimation(...args: Parameters<Animator3d['setAnimation']>) {
		return this.animator.setAnimation(...args);
	}

	destroy(): void {
		this.model.destroy({ children: true });
		this.material.destroy();
		super.destroy();
	}
}
