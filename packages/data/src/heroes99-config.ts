export interface Heroes99Animation {
  start: number
  end: number
}

export interface Heroes99LayerSkin {
  path: string
  colors_available: number[]
}

export interface Heroes99LayerFace {
  path: string
  colors_available: number[]
}

export interface Heroes99LayerCloth {
  path_top: string
  path_bot: string
  styles_available: number[]
  colors_available: number[]
}

export interface Heroes99LayerHair {
  path_top: string
  path_bot: string
  styles_available: number[]
  colors_available: number[]
}

export interface Heroes99LayerWeapon {
  path_top: string
  path_bot: string
  colors_available: number[]
}

export interface Heroes99Layers {
  base_path: string
  skin: Heroes99LayerSkin
  face: Heroes99LayerFace
  cloth: Heroes99LayerCloth
  hair_male: Heroes99LayerHair
  hair_female: Heroes99LayerHair
  weapon_1_sword: Heroes99LayerWeapon
  weapon_2_spear: Heroes99LayerWeapon
  weapon_3_wand: Heroes99LayerWeapon
  weapon_4_axe: Heroes99LayerWeapon
  weapon_5_dagger: Heroes99LayerWeapon
}

export interface Heroes99Config {
  animations: Record<string, Heroes99Animation>
  layers: Heroes99Layers
}

export const HEROES99_CONFIG: Heroes99Config = {
  animations: {
    Idle1: {
      start: 1,
      end: 6,
    },
    Idle2: {
      start: 7,
      end: 12,
    },
    Run1: {
      start: 13,
      end: 20,
    },
    Run2: {
      start: 21,
      end: 28,
    },
    Jump: {
      start: 29,
      end: 36,
    },
    Attack1: {
      start: 37,
      end: 42,
    },
    Attack2: {
      start: 43,
      end: 48,
    },
    Attack3: {
      start: 49,
      end: 52,
    },
    AirAtk1: {
      start: 53,
      end: 58,
    },
    AirAtk2: {
      start: 59,
      end: 62,
    },
    Casting1: {
      start: 63,
      end: 67,
    },
    Casting2: {
      start: 68,
      end: 72,
    },
    Hurt: {
      start: 73,
      end: 76,
    },
    Dying: {
      start: 77,
      end: 81,
    },
    Dash: {
      start: 82,
      end: 89,
    },
    Block: {
      start: 90,
      end: 94,
    },
    Roll: {
      start: 95,
      end: 102,
    },
  },
  layers: {
    base_path: "commercial_do_not_use/Heroes99_v1.2/",
    skin: {
      path: "skin/skin_c{color}.png",
      colors_available: [1, 2, 3, 4, 5, 6],
    },
    face: {
      path: "face/face_c{color}.png",
      colors_available: [1, 2, 3, 4, 5, 6, 7],
    },
    cloth: {
      path_top:
        "cloth/cloth{style}/cloth{style}_top/cloth{style}_c{color}_top.png",
      path_bot:
        "cloth/cloth{style}/cloth{style}_bot/cloth{style}_c{color}_bot.png",
      styles_available: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
      ],
      colors_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    hair_male: {
      path_top: "hair/m{style}/m{style}_top/m{style}_c{color}_top.png",
      path_bot: "hair/m{style}/m{style}_bot/m{style}_c{color}_bot.png",
      styles_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      colors_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    hair_female: {
      path_top: "hair/f{style}/f{style}_top/f{style}_c{color}_top.png",
      path_bot: "hair/f{style}/f{style}_bot/f{style}_c{color}_bot.png",
      styles_available: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      colors_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    weapon_1_sword: {
      path_top: "weapon/weapon1/weapon1_top/weapon1_top.png",
      path_bot: "weapon/weapon1/weapon1_bot/weapon1_bot.png",
      colors_available: [1],
    },
    weapon_2_spear: {
      path_top: "weapon/weapon2/weapon2_top/weapon2_top.png",
      path_bot: "weapon/weapon2/weapon2_bot/weapon2_bot.png",
      colors_available: [1],
    },
    weapon_3_wand: {
      path_top: "weapon/weapon3/weapon3_top/weapon3_top.png",
      path_bot: "weapon/weapon3/weapon3_bot/weapon3_bot.png",
      colors_available: [1],
    },
    weapon_4_axe: {
      path_top: "weapon/weapon4/weapon4_top/weapon4_top.png",
      path_bot: "weapon/weapon4/weapon4_bot/weapon4_bot.png",
      colors_available: [1],
    },
    weapon_5_dagger: {
      path_top: "weapon/weapon5/weapon5_top/weapon5_c{color}_top.png",
      path_bot: "weapon/weapon5/weapon5_bot/weapon5_c{color}_bot.png",
      colors_available: [1, 2, 3, 4],
    },
  },
}
