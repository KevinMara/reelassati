# Model and provider register

**Register version:** `eu-ai-act-2026-08-04.v1`

**Rule:** the deployed route, not the UI label, determines the provider/model
fact recorded in provenance and release evidence.

This register covers AI models and adjacent external services that affect the
AI-content lifecycle. It supports `GOV-001`, `PRV-001`, `SUP-001`, `MON-001`,
and `EVD-001`. It is not a vendor endorsement and does not establish that any
provider has supplied sufficient legal, privacy, security, copyright, marking,
or detection evidence.

The routes below are source-configurable defaults, not a verified snapshot of a
current production deployment. Actual hosted values, model aliases/versions,
territory, contracting entity, test-mode state, and effective provider path must
be captured without secrets in each release evidence record. As of 4 August
2026, the complete provider evidence packets and independent inherited-mark/
detection validation are not recorded and remain public-launch blockers.

The role analysis follows the official [GPAI guidelines](https://ai-act-service-desk.ec.europa.eu/sites/default/files/2025-07/guidelines_on_the_scope_of_the_obligations_for_generalpurpose_ai_models_established_by_regulation_1cx2atxgq79us4n3x8jfgyy1qlm_118340-3.pdf)
and [Article 50 guidelines](https://digital-strategy.ec.europa.eu/en/policies/guidelines-transparency-ai-generated-content).

## REELassati system role

| Item               | Current recorded position                                                                                                                                                                                                                                        | Reassessment trigger                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product role       | Working classification: provider of the branded downstream REELassati AI system for routes it offers; potentially also deployer where the operator uses outputs in its own professional activity. Exact legal/contractual facts remain to be verified.           | White-labelling, reseller/agency operation, material allocation change, new territory, contractual control change, or completed legal role review.                                                                           |
| GPAI-model role    | Working classification: not a GPAI-model provider because the application appears to call upstream services and does not presently train, place on the market, or materially modify general-purpose model weights. This is not a conclusive legal determination. | Training/fine-tuning, weight access, self-hosting, model release, material capability/general-purpose modification, model marketed under REELassati's name, or contrary legal/provider evidence.                             |
| Intended purpose   | Creative and marketing production only.                                                                                                                                                                                                                          | Any feature or sales/use instruction involving decisions about people, regulated/essential services, emotion/biometric inference, social scoring, medical/legal/law-enforcement/migration use, or another unassessed domain. |
| Territory baseline | Built to support EU public-release analysis. Actual territories and establishment facts remain part of the operator/release decision.                                                                                                                            | Public launch, geographic expansion, reseller, or change of legal operator.                                                                                                                                                  |

If the GPAI-model role changes, stop relying on this downstream-only register
and assess Articles 53–55, the [GPAI Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai),
and the mandatory [GPAI training-content summary template](https://digital-strategy.ec.europa.eu/en/faqs/template-general-purpose-ai-model-providers-summarise-their-training-content).

## Source-configurable routes

| Route ID                   | Product operation                                                            | Service path             | Default model / configurable value                                                             | Test/production boundary                                                                                                                                                                                                  | Output and provenance expectation                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ROUTE-TEXT-OR-001`        | Script generation, edit planning, and other default structured text requests | OpenRouter               | `OPENROUTER_TEXT_MODEL`; fallback `moonshotai/kimi-k2.5`                                       | Official/default route when Kimi test mode is disabled.                                                                                                                                                                   | Record exact provider/model and invocation; mark final text; preserve script/edit provenance; provide detection; keep proposed edits reviewable rather than claiming they were applied.                      |
| `ROUTE-TEXT-KIMI-TEST-001` | Same default text operations during owner-only subscription testing          | Direct Kimi Code service | `KIMI_CODE_MODEL`; fallback `k3-256k`                                                          | **Test-only.** Activated only when `KIMI_TEST_MODE=enabled`, only when no explicit model is selected. Must be disabled for the official route unless a separately approved architecture decision replaces this invariant. | Same system-level provenance, marking, detection, intended-use and review duties as the official route. Subscription access does not transfer REELassati's downstream responsibilities.                      |
| `ROUTE-ANALYSIS-OR-001`    | Video analysis and reviewable edit suggestions                               | OpenRouter               | `OPENROUTER_ANALYSIS_MODEL`; fallback `google/gemini-2.5-flash`                                | Always OpenRouter, including while Kimi test mode is enabled.                                                                                                                                                             | Record analysis model/provider and input/output fingerprints; label scores as editorial rubric estimates, not predicted views; provenance on AI edit proposals; no automatic application.                    |
| `ROUTE-TRENDS-KIMI-001`    | Weekly platform trend formats and credit-based custom trend research         | OpenRouter + web search  | `OPENROUTER_TREND_MODEL`; fallback `moonshotai/kimi-k2.5`                                      | Weekly refresh is system-scheduled and shared; every completed custom request reserves and consumes one product credit. No user-triggered shared refresh or free duplicate scan exists.                                   | Record exact model, scope, source URLs and invocation status; reject unverified URLs; separate observed evidence from hypotheses; refund failed custom reservations.                                         |
| `ROUTE-STT-OR-001`         | Audio/video transcription                                                    | OpenRouter               | `OPENROUTER_STT_MODEL`; fallback `openai/whisper-large-v3-turbo`                               | Always OpenRouter.                                                                                                                                                                                                        | Record provider/model and provenance; distinguish transcription from verified fact; preserve original upload; apply output marking/detection analysis to final externally usable text.                       |
| `ROUTE-TTS-OR-001`         | Synthetic speech generation                                                  | OpenRouter               | `OPENROUTER_TTS_MODEL`; fallback `minimax/speech-2.8-turbo`; voice from `OPENROUTER_TTS_VOICE` | Always OpenRouter.                                                                                                                                                                                                        | Record model and voice configuration; mark generated audio; detection path; preserve generated origin in R2/D1/workspace; require realistic synthetic-media and real-person/voice review before publication. |
| `ROUTE-VIDEO-OR-001`       | Synthetic video generation                                                   | OpenRouter               | `OPENROUTER_VIDEO_MODEL`; fallback `kwaivgi/kling-v3.0-std`                                    | Always OpenRouter.                                                                                                                                                                                                        | Register stable job before provider submission; record actual model; final asset provenance and machine marking; detection; realistic-synthetic/deepfake review; public disclosure where required.           |
| `ROUTE-PUBLISH-ZER-001`    | Connected-account publication, scheduling, and status reconciliation         | Zernio                   | No AI model                                                                                    | Production external distribution service; `ZERNIO_API_KEY`.                                                                                                                                                               | Immutable compliance review and exact disclosure-bearing payload must bind to the durable outbox intent; stable request ID; ambiguous outcome lock; reconciliation; no fabricated published state.           |

## Provider evidence packet

Each AI route requires an evidence packet. Mark unknowns explicitly; do not
convert an unavailable document into “not applicable.” At minimum record:

| Evidence ID | Required fact or artefact                                                                                                                | Why it matters                                             | Acceptable status values                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `PE-01`     | Legal provider/service identity, contracting entity, role, territory, and contact/escalation channel                                     | Correct role and accountability allocation                 | `verified`, `gap`, `not-applicable-with-reason`         |
| `PE-02`     | Exact route, model identifier/version, capability, modality, change/version policy, and deprecation notice mechanism                     | Provenance accuracy and change control                     | `verified`, `gap`                                       |
| `PE-03`     | Applicable terms, enterprise terms, data processing terms, privacy information, and subprocessor/transfer facts                          | Separate data-protection and contractual review            | `legally-reviewed`, `gap`, `not-applicable-with-reason` |
| `PE-04`     | Prompt/input/output retention, training use, human access, deletion, security, and incident commitments                                  | Privacy, confidentiality, trade-secret and evidence risk   | `verified`, `gap`                                       |
| `PE-05`     | Upstream AI Act role statement and technical documentation made available to downstream providers                                        | Supports but does not replace REELassati duties            | `verified`, `gap`                                       |
| `PE-06`     | Native machine-readable marking method by modality, creation timing, transform robustness, and exact model/route coverage                | Determines whether an upstream mark can be inherited       | `independently-verified`, `unsupported`, `gap`          |
| `PE-07`     | Corresponding detection method, access/API terms, human-readable output, accuracy/robustness/interoperability evidence, and availability | Article 50(2) requires detection as well as marking        | `independently-verified`, `unsupported`, `gap`          |
| `PE-08`     | Copyright policy, rights/consent controls, training-content information where applicable, and complaint/takedown channel                 | Separate IP/personality-right risk; relevant GPAI evidence | `legally-reviewed`, `gap`                               |
| `PE-09`     | Safety restrictions, abuse response, security/incident notifications, model rollback, and service status evidence                        | Incident containment and provider-drift monitoring         | `verified`, `gap`                                       |
| `PE-10`     | Sample outputs independently tested by REELassati for provenance, marking, detection, mutation, export, and failure behavior             | Provider statements alone are insufficient                 | `pass`, `partial`, `fail`, `not-tested`                 |

The provider register must point to the controlled evidence location and record
the reviewer/date. Do not commit vendor-confidential contracts, keys, personal
data, or security-sensitive evidence to this public/product repository.

## Upstream-mark reliance decision

An upstream mark may be relied upon only after all of the following are true:

- the exact route/model/modality used by REELassati is covered;
- REELassati can preserve the mark through its transformations and export path;
- a corresponding detector is accessible and produces a human-understandable
  result;
- REELassati has independently tested positive, negative, altered, compressed,
  cropped/transcoded, and tampered samples appropriate to the modality;
- effectiveness, reliability, robustness, interoperability, and technical
  feasibility are documented;
- failures are observable and fail safely;
- contractual/technical changes trigger revalidation;
- the release record states which part is inherited and which part is added by
  REELassati.

If any item is absent, REELassati must supply an adequately effective system-level
solution or block the affected covered final output. Do not describe a selected
solution as the sole legally mandated standard; the final Article 50 guidelines
state that provider-independent interoperable solutions and harmonised standards
remain technically unsettled.

## Routing invariants

1. Kimi test mode applies only to default text requests lacking an explicit
   model argument.
2. Analysis, transcription, speech, and video remain on their explicit
   OpenRouter routes while test mode is enabled.
3. Test mode off restores OpenRouter for default text generation.
4. Provider secrets remain server-only and are never stored in provenance,
   workspace data, logs, errors, documentation, or release manifests.
5. Every invocation stores the actual provider/model selected at runtime.
6. No silent fallback to another model/provider is permitted. An intentional
   fallback must be registered, evidenced, visible in provenance, and tested.
7. Model aliases are not treated as immutable versions. Where the provider does
   not expose a stable version, record that limitation and the observation time.
8. Environment changes affecting routing are production changes even when no
   source file changes.

## Change triggers requiring a register update

- environment-variable default or hosted value changes;
- model alias/version, endpoint, provider, aggregator, account, region, or
  credential class changes;
- new modality, generation route, tool call, agent, memory, retrieval source,
  fine-tuning, weights, self-hosting, or safety filter;
- new output save/export/publication path;
- provider terms, privacy/data-use, retention, subprocessor, copyright,
  marking/detection, safety, or incident commitment changes;
- unexplained output-format change, missing mark, detector regression, model
  drift, outage, or security incident;
- test-only route becoming accessible to clients or a public environment;
- any change that could make REELassati a GPAI-model provider.

## Release evidence snapshot template

Complete without secret values:

```text
Release/version:
Policy version:
Environment/audience:
KIMI_TEST_MODE enabled: yes/no
ROUTE-TEXT-OR-001 actual model:
ROUTE-TEXT-KIMI-TEST-001 actual model or disabled:
ROUTE-ANALYSIS-OR-001 actual model:
ROUTE-STT-OR-001 actual model:
ROUTE-TTS-OR-001 actual model and voice:
ROUTE-VIDEO-OR-001 actual model:
ROUTE-PUBLISH-ZER-001 enabled: yes/no
Provider evidence revision/date:
Marking/detection test revision:
Known aliases or version uncertainty:
Open gaps and owner/due date:
Reviewer/date:
```

## Honest limitations

- A working API key, successful test request, or provider dashboard status does
  not establish legal compliance.
- Upstream code/signatory status does not automatically make REELassati
  compliant and does not remove downstream system-provider duties.
- The provider/model register cannot resolve copyright, consent, personality
  rights, privacy, advertising, or platform-rule legality for a specific output.
- No provider is described here as “EU certified.” The [Article 50 Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
  is voluntary, and even adherence is not conclusive proof of compliance.
- Exact operator identity and release status remain unresolved public-launch
  blockers, as does the first EU availability/market/service date relevant to
  transition analysis.
- No complete `PE-01`–`PE-10` packet, production route snapshot, or independent
  upstream marking/detection validation is established by this register alone.
