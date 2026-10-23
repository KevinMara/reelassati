# Video Analyzer: evidence, sections and optimization

This release addresses the standalone analyzer. It does not resume a stopped paid editor test or authorize inference, schedules, other-chat work, or billing changes. Kimi K3 routing and the permanent research shutdown are unchanged.

## Product behavior

- Review source-time moments, with observable picture/audio evidence, strengths, improvements and editorial reasoning. Unsupported audio must stay unverified; a soundtrack is not proof that the provider heard it.
- Recognize hook, setup, tension, development, demonstration, core, proof, transition, payoff, resolution, loop, CTA, other and unclassified functions. Consecutive observations with the same function become a section. Repeated functions and coverage gaps remain separate. Development/demonstration satisfy the broad core assessment; resolution can satisfy payoff. Missing CTAs are allowed.
- Show six video-level dimensions: hook, pacing, attention, clarity, processing load and stimulation. Attention/clarity/load/stimulation and section indices use duration-weighted observations. The existing editorial-v1 scalar remains a transparent product index: 45% attention + 35% clarity + 20% processing ease. It is not a validated quality/performance formula; neither low load nor high stimulation is universally optimal. The individual dimensions and source evidence matter more than a single rank.
- Import portable CSV with exact headers `time_seconds,retention_percent`, a data source, reporting period/audience segment, and a positive view count. Source seconds must be unique, increasing and in bounds. Values above 100% are retained for repeated viewing. Import does not call AI. Data is user supplied, not independently verified.
- Show imported observations on a separate gold percentage chart, synchronized to source time. Moment details use only actual samples inside that interval. No missing response is interpolated into a measurement. Differences are percentage points and do not establish causation.
- Retain the six most recent complete source-bound reports in the existing private workspace JSON, with bounded size. Reopening a review does not buy another analysis. Imported audience data is retained with the report. These workspace snapshots are notes, not server-authoritative evidence for charging or inference permission.
- Reject an audience import that would exceed its saved-report capacity before changing the workspace. A large, syntactically valid CSV must never silently remove the original paid review. Metadata probing is bounded and cancellable and retains full source-clock precision and native dimensions.
- Prepare an optimization brief locally from all moment observations, preservation instructions, timestamped actions, source identity and any imported response. Quotes/metadata are explicitly evidence, not higher-priority instructions. The brief requires source-clock mapping, genre-appropriate pacing, supported operations and honest reporting of reshoots/missing assets.
- Create a separate project in the source's portrait, square or landscape orientation. Contain fit preserves the full frame for other source ratios. Opening its optimization dialog prefills the brief but never runs AI, including after an asynchronous workspace load. The editor's existing explicit credit quote and execution control remain the paid trigger. Existing references and style templates continue to apply.
- Download a portable analysis JSON and editor brief without inference. Source signed URLs are not included.

## Evidence boundaries

Content observations, research-informed editorial interpretations and measured audience response are different evidence classes. This release supplies no EEG, dopamine, physiological arousal, brain-region activation, calibrated attention model or guaranteed performance lift. It does not automatically connect a platform's audience analytics or prove imported data belongs to the selected edit. Exact-version alignment remains necessary.

Research/official context:

- [YouTube: audience retention key moments](https://support.google.com/youtube/answer/9314415?hl=en). Spikes can involve rewatching or difficulty understanding; dips can involve skipping or leaving. A curve does not identify the causal stimulus by itself.
- [Magliano and Zacks (2011): continuity editing and event segmentation](https://doi.org/10.1111/j.1551-6709.2011.01202.x). This study motivates preserving coherent action across cuts; it does not validate our numeric scores or predict a viewer's brain activity from an uploaded clip.
- [Lang (2000): limited-capacity model of mediated message processing](https://doi.org/10.1111/j.1460-2466.2000.tb02833.x). Limited processing capacity motivates specific load/clarity tradeoffs, not universal faster/louder editing.

## Verification and remaining validation

Deterministic contract tests cover malformed/misaligned data, replay percentages, absent measurements, source durations, section grouping and optimization instructions. Worker workspace PUT/stored JSON/GET tests cover retained reports, measured data and editor briefs. Existing source-mapping tests guard trimmed/speed-adjusted occurrences and locked/ambiguous edits. UI verification uses a local synthetic fixture and owned local motion sample; its scores are explicitly not model findings.

Live K3 analysis accuracy and an optimized rendered output are not verified by synthetic fixtures or passing tests. Before treating this as a validated analyzer, run separately authorized visible checks across different forms (for example explanation, narrative, comedy and demonstration), compare section boundaries and claims with human annotations, inspect the actual rendered edits, and compare matched audience measurements where available. Do not use an AI rescore as proof of viewer improvement. No such paid test is authorized or started by this document.

The native Sites connector is unavailable in the originating chat. Backend release requires a separately authorized, bounded, visibly followed deployment turn if another chat must perform it. No continuation is queued.
