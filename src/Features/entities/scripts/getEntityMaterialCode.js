// {{materialCategoryType - materialCategoryCode - 001}}

import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";
import getCategoryAsync from "Features/nomenclatures/services/getCategoryAsync";

export default async function getEntityMaterialCode(material, materials) {
  console.log("debug_1211_getEntityMaterialCode", material, materials);

  // edge case

  if (!material?.category) return null;

  // main

  const { id, nomenclatureId } = material?.category ?? {};
  const category = await getCategoryAsync(id, nomenclatureId);

  // materials

  const similarMaterials = materials.filter((m) => m.category?.id === id);
  const idx = similarMaterials.map(({ id }) => id).indexOf(material?.id) + 1;

  // final strings

  const s1 = category.type ? `${category.type} - ` : "";
  const s2 = category.code ? `${category.code} - ` : "";
  const s3 = getZeroPaddingNumber(idx, 3);

  // return

  return s1 + s2 + s3;
}
