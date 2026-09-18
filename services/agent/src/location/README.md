# Location

Implemented. `context.ts` validates the coarse place context the mobile app
sends and renders it as an honest description for the model. It never receives
or keeps an exact coordinate history, and simulated demo context is always
labelled as simulated so the model does not present it as real.

Google Places is not integrated. Place names come from the device (real
provider: a neutral label only) or from the demo route.
