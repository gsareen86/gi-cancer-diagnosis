# Evidence notes and assumptions — checked 2026-09-13

These notes correct assumptions in the pasted AI discussion. They are not an approval
to deploy, a legal opinion or clinical validation. User decisions remain in the brief.

## Azure India: deployment type matters

Microsoft distinguishes Global, Data Zone and geography-based processing. An Indian
resource can therefore still use a deployment whose inference leaves India. Standard
or regional provisioned options may meet the policy when the selected model, geography
and actual service configuration support it; availability must be checked at deployment.
Do not assume a particular model/SKU is available in Central India or that an APAC zone
means India-only. [Microsoft deployment types](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/deployment-types).

Microsoft states prompts and completions are not used to train foundation models
without permission, but that is distinct from storage, stateful API features, abuse
monitoring and possible human review. The pilot must document its selected API features,
contract, monitoring settings and data flows. A local or Azure adapter alone proves
none of those deployment facts. [Microsoft data privacy](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy).

## Data roles, purpose and retention

The DPDP Act defines the fiduciary by who determines processing purpose and means,
alone or together with others. Accordingly, the owner's company is the proposed
primary operator, while each clinical site's actual role still needs documentation.
IP ownership is separate from patient-data rights. The Act addresses purpose, consent,
processor arrangements and erasure with retention exceptions; “personally sourced”
does not describe the necessary permission or reuse purpose.
[DPDP Act, definitions and processing provisions](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf).

Commencement is phased. The first institutional provisions and later operational
provisions must not be described as all effective at once. Check the official
notifications and the site's applicable current health/privacy requirements when
activating the pilot. India-only deployment here is an explicit product constraint,
not a blanket localisation claim inferred from DPDP.
[MeitY commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf),
[existing dated applicability register](../india-privacy.md).

The unspecified pilot-end policy is therefore a **pre-pilot decision**: record which
records are returned/exported, erased, retained under an identified duty or hold, and
when vendor and backup copies expire. Do not invent a universal 30-day deletion rule.

## Open-source image quality checks

OpenCV provides image-processing primitives such as the Laplacian. A blur heuristic
using them is an engineering proposal, not a validated medical-report readability
test. It must be calibrated across resolutions and document types and supplemented
by other checks. [OpenCV Laplace operator](https://docs.opencv.org/4.13.0/d5/db5/tutorial_laplace_operator.html).

Tesseract documents OCR effects from resolution, noise, binarisation, borders and skew,
and limitations around tables. This supports checking/repairing capture quality, while
preserving the original and verifying extraction separately. A clean-looking photo
does not guarantee correct lab values or complete clinical content.
[Tesseract quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html).

## Claims not adopted from earlier AI responses

The NMC telemedicine guidance's technology-platform section addresses AI counselling
and support to an RMP. It should be assessed against the actual workflow, not treated
as a blanket exemption for an internal pilot. The official PDF was indexed but could
not be fetched in full during this check; do not claim a complete legal re-review.
[NMC published guidance](https://www.nmc.org.in/wp-content/uploads/2019/10/Public_Notice_for_TMG_Website_Notice-merged.pdf).
CDSCO's [medical-device resources](https://www.cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/Medical-Device-Diagnostics/)
list software guidance; confirm the current instrument and intended-use classification
with an appropriate adviser. This reset assigns no risk class or exemption.

- Neither a clinician-in-the-loop pilot nor a disclaimer automatically resolves
  medical-software classification, ethics/site review, consent or professional duties.
  The current intended-use statement needs the relevant qualified review before use.
- No sourced basis has been established here for “AI does 95%”, “60–90 seconds per
  case”, a universal emergency miss rate, fixed hospital willingness-to-pay, or all
  symptom patterns implying stage III/IV. Those are not project facts or targets.
- A rule's reachability or zero failures in a test set does not eliminate all unsafe
  clinical outcomes. Tests establish only their stated software behaviours.
- Do not force tuberculosis or any other cause into every differential. The clinical
  lead can curate region-relevant alternatives and evaluation cases; unsupported
  numerical priors and indiscriminate diagnosis padding are inappropriate.

Reference-image candidates from the prior review remain in the
[image register](../reference-image-register.md). Their licence and clinical suitability
are separate checks. Nothing in this reset publishes those assets.
