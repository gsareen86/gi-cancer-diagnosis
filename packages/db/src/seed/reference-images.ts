/**
 * The reference image library.
 *
 * Every asset must carry a real source and licence before it can be published — the seed
 * deliberately leaves them as drafts with placeholder attribution, so nothing reaches a patient
 * until the clinical co-founder supplies licensed originals or their own illustrations. Scraped
 * clinical images are not an option.
 */
export interface ReferenceImageSeed {
  key: string;
  captionKey: string;
  altTextKey: string;
  /** Placeholder until a licensed asset is supplied; publication is refused while it says so. */
  source: string;
  licence: string;
  storageKey: string;
}

const PENDING = 'TODO(confirm): supply a licensed or clinician-authored original';

const image = (key: string): ReferenceImageSeed => ({
  key,
  captionKey: `image.${key}.caption`,
  altTextKey: `image.${key}.alt`,
  source: PENDING,
  licence: PENDING,
  storageKey: `reference/${key}`,
});

export const REFERENCE_IMAGES: ReferenceImageSeed[] = [
  image('img_body_map'),
  image('img_stool_form_chart'),
  ...Array.from({ length: 7 }, (_, index) => image(`img_stool_type_${index + 1}`)),
  image('img_blood_appearance_chart'),
  image('img_blood_bright_red'),
  image('img_blood_dark_red'),
  image('img_blood_black_tarry'),
  image('img_blood_position'),
  image('img_blood_mixed'),
  image('img_blood_coating'),
  image('img_jaundice_eyes'),
  image('img_jaundice_skin'),
  image('img_urine_colour_chart'),
  image('img_pale_stool'),
  image('img_vomit_reference'),
  image('img_haematemesis'),
  image('img_coffee_grounds'),
];

/** An asset is publishable only once its attribution is real. */
export function isPublishable(asset: ReferenceImageSeed): boolean {
  return !asset.source.startsWith('TODO') && !asset.licence.startsWith('TODO');
}
