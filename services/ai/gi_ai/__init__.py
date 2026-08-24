"""GI Compass AI service.

The only component that talks to a model provider. Isolating it here makes the egress boundary
one auditable place, and keeps the provider key out of the core application entirely.

Nothing in this service decides anything clinical. It compiles a prompt from a summary the core
application already built, calls the model under a strict contract, and returns whatever came
back. The core application validates that response against the same schema it generated — a
response this service considers fine is still rejected there if it does not conform.
"""

__version__ = "0.1.0"
