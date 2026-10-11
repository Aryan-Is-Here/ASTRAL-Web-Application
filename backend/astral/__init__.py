"""ASTRAL — Advanced Space Traffic Risk Assessment & Analysis Laboratory."""

__version__ = "0.1.0"

# Every persisted result records these identifiers so a rerun can be traced to
# the exact algorithm revision that produced it. Bump the relevant entry when
# the behaviour of an algorithm changes, not only when the package version does.
ALGORITHM_VERSIONS = {
    "screening": "screen-kdtree-brent/1",
    "encounter_geometry": "rtn-encounter/1",
    "pc_foster_2d": "foster2d-gauss-legendre/1",
    "pc_monte_carlo": "mc-rectilinear/1",
    "covariance_validation": "cov-validate/1",
    "maneuver_sim": "impulsive-j2-dop853/1",
    "report": "report/1",
}
