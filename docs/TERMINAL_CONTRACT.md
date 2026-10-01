# Terminal Identity + Speech Contract

PR 2 makes every monitor explain what it is and what it is doing without relying on color alone.

## Two terminal classes

### Role Terminal
A cognitive job inside the Think Tank.

Current roles:
- Vessie Prime
- Dreamer
- Builder
- Challenger
- Archivist

A role terminal owns:
- role identity
- behavioral verbs / visual motif
- live state
- phase
- last utterance
- current seat staffing

### Seat Terminal
A provider/model substrate that can staff one or more roles.

Current seats:
- OpenAI
- Kimi
- Local Brain

A seat terminal owns:
- provider identity
- eventual model binding
- capability meters
- staffing list
- derived activity state

A seat is **not** a cognitive role.

## Terminal states

| State | Meaning | Non-color signal |
| --- | --- | --- |
| idle | available, no active session work | ○ + IDLE |
| selected | explicitly selected/pinned | ◆ + SELECTED |
| listening | session participant waiting/receiving | ◉ + LISTENING |
| thinking | processing without speaking | ≋ + THINKING |
| speaking | current active speaker | ▮▮▮ + SPEAKING |
| warning | objection/fault attention state | ! + WARNING |
| dimmed | intentionally de-emphasized but still available | · + DIMMED |
| offline | unavailable | × + OFFLINE |

**Dimmed is not offline.** A dimmed terminal remains part of the room and may be reactivated.

## Speech viewport

Every Role Terminal must show:
1. state using text and symbol, not color alone,
2. current/last session phase,
3. 2–4 readable lines of the latest utterance,
4. which seat currently staffs the role.

The full transcript remains in the Receipt / Ledger. The viewport is the live operational glance surface.

## Seat staffing

Seat activity is derived from the roles assigned to it. If a seat staffs a speaking or warning role, that state is projected on the seat. The seat never invents independent cognitive speech.

## Acceptance criteria

A first-time viewer must be able to answer, without opening the ledger:
- Is this monitor a role or a provider/model seat?
- What state is it in?
- What did the role last say?
- Which phase produced that utterance?
- Which seat is staffing the role?
- Which roles are currently staffed by a given seat?
