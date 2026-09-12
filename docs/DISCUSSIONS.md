# GitHub Discussions

AgentBlindspot uses GitHub Discussions for questions, design exploration, and community knowledge that does not yet describe a confirmed repository defect.

## Use Discussions when

- you want help interpreting an evidence state or diagnostic;
- you have a design or compatibility question before proposing code;
- you want to compare approaches for adapters, graph resolution, coverage mapping, reporting, or integrations;
- the question may produce a reusable answer for other users.

Use an Issue instead when you can already provide a concrete defect, reproducible unsupported case, or scoped implementation request. For bugs, prefer the repository's minimal-reproducer issue form.

## Ask evidence-first questions

A useful question should include, when relevant:

- exact AgentBlindspot version or source commit;
- operating system and Node version;
- the exact command that was run;
- the observed evidence state or diagnostic;
- the expected behavior and why;
- the smallest synthetic or safely redacted repository/session/coverage fixture needed to explain the case.

Do not paste private coding-agent transcripts, credentials, proprietary source, or sensitive repository paths when a synthetic example can demonstrate the same behavior.

## Keep evidence, inference, and uncertainty separate

When answering a question, distinguish:

1. **Observed evidence** — what the report, fixture, graph edge, adapter event, or coverage artifact actually shows.
2. **Inference** — what can reasonably be concluded from that evidence.
3. **Unknowns** — what the available data cannot establish safely.

A `POSSIBLE_BLIND_SPOT` is an attention signal, not proof of a defect. `UNKNOWN` should remain unknown until stronger evidence supports a classification.

## Accepted answers

For Q&A Discussions, the question author should mark an answer as accepted when it resolves the original question with a reproducible explanation or a clearly documented limitation. An accepted answer should not be used to imply stronger technical certainty than the evidence supports.

If the accepted answer identifies a confirmed defect or a scoped implementation task, open an Issue and link the Discussion so the technical work remains trackable.
