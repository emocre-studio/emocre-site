
import {dataPath, siteAssetsPath, siteDataPath, creaturesDir, artBase} from './paths'
import {emotionEnToPt} from '@emocre/tools/src/schema/emotion'
import {Types} from '@emocre/tools/src/type/types'
import {ComplexTypes} from '@emocre/tools/src/type/complex-types'
import fs from 'fs'
import {writeJson} from '@emocre/tools/src/file/serialize'

import {CreaturesFileRepository} from '@emocre/tools/src/creature/creatures-file-repository'

async function emotionEnToEn(emotion: string, typesFile: string): Promise<string> {
  const [types, complexTypes] = await Promise.all([Types.readFromFile(typesFile), ComplexTypes.readFromFile(typesFile)])
  const complexEntry = complexTypes.find(t => t.name_en === emotion)
  if (complexEntry) return complexEntry.name_en
  const typeEntry = types.find(t => t.key === emotion)
  if (typeEntry) return typeEntry.name_en
  throw new Error(`Emoção não encontrada: ${emotion}`)
}

(async () => {
  const repo = new CreaturesFileRepository(creaturesDir, artBase)
  const creatures = await repo
    .where(c => c.site)
    .whereArtFrontExists()
    .execute()

  function destinationCreatureImagePath(emotion: string, stage: number): string {
    return `${siteAssetsPath}/creatures/${emotion}-${stage}-art-front.png`
  }


  const out = await Promise.all(creatures
    .map(async (c) => {
      return {
        number: c.number,
        name: c.name_pt,
        nameEn: ((c as any).name_en?.trim()) || c.name_pt,
        description: c.description_pt,
        descriptionEn: (c.description_en?.trim()) || c.description_pt,
        type1Pt: await emotionEnToPt(c.type_1 as any, dataPath('type/types.yml')),
        type2Pt: c.type_2 ? await emotionEnToPt(c.type_2 as any, dataPath('type/types.yml')) : undefined,
        type1En: await emotionEnToEn(c.type_1 as any, dataPath('type/types.yml')),
        type2En: c.type_2 ? await emotionEnToEn(c.type_2 as any, dataPath('type/types.yml')) : undefined,
        type1: c.type_1,
        type2: c.type_2,
        emotion: c.emotion.toLowerCase(),
        emotionPt: await emotionEnToPt(c.emotion, dataPath('type/types.yml')),
        stage: c.stage,
        energy: c.energy,
        attack: c.power,
        defense: c.defense,
        speed: c.speed,

        complexTypeName: c.complexTypeName,
        artPath: c.artFrontPath,
      }
    }))

  await Promise.all(creatures.map(async (c) => {
    const destinationFile = destinationCreatureImagePath(c.emotion.toLowerCase(), c.stage)
    if (!fs.existsSync(c.crtArtPathAbs)) {
      throw new Error(`CRT sprite not found (run emocre-art \`make sprites\` then re-vendor): ${c.crtArtPathAbs}`)
    }
    await fs.promises.copyFile(c.crtArtPathAbs, destinationFile)
  }))
  const outPath = `${siteDataPath}/creatures.json`
  await writeJson(outPath, out)
})()
