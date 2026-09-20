"""Evidence service — builds provenance records with telemetry claims for every data source used."""

from __future__ import annotations

from app.core.logging import get_logger
from app.schemas.marine import WeatherData, MarineConditions, TideData, PFZAdvisory
from app.schemas.response import EvidenceItem

logger = get_logger("services.evidence")


def build_evidence(
    weather: WeatherData | None,
    marine: MarineConditions | None,
    tide: TideData | None,
    pfz: PFZAdvisory | None,
) -> list[EvidenceItem]:
    """Produce a list of evidence items showing what data was used, its claim, and its source."""
    items: list[EvidenceItem] = []

    if weather:
        w_spd = weather.wind_speed_kmh
        w_dir = weather.wind_direction_label or "Variable"
        w_claim = f"Wind {w_spd:.0f} km/h {w_dir}" if w_spd is not None else f"Wind {w_dir}"
        if weather.weather_description:
            w_claim += f" ({weather.weather_description})"
        items.append(
            EvidenceItem(
                source=weather.source,
                data_type="weather",
                timestamp=weather.timestamp,
                claim=w_claim,
                metric=f"{w_spd:.0f} km/h" if w_spd is not None else "Observed",
                is_live=weather.is_live,
            )
        )

    if marine:
        w_ht = marine.wave_height_m
        m_claim = f"Waves {w_ht:.1f}m" if w_ht is not None else "Waves observed"
        if marine.sea_surface_temperature_c is not None:
            m_claim += f", SST {marine.sea_surface_temperature_c:.1f}°C"
        items.append(
            EvidenceItem(
                source=marine.source,
                data_type="marine_conditions",
                timestamp=marine.timestamp,
                claim=m_claim,
                metric=f"{w_ht:.1f} m" if w_ht is not None else "Observed",
                is_live=marine.is_live,
            )
        )

    if tide:
        t_claim = f"Tide {tide.tide_status or 'Report'}"
        if tide.next_high:
            t_claim += f" (High {tide.next_high})"
        elif tide.current_level_m is not None:
            t_claim += f" ({tide.current_level_m:+.2f}m MSL)"
        items.append(
            EvidenceItem(
                source=tide.source or "none",
                data_type="tide",
                timestamp=tide.timestamp,
                claim=t_claim,
                metric=tide.tide_status or "Tide",
                is_live=tide.is_live,
            )
        )

    if pfz:
        p_claim = (
            f"PFZ: {pfz.zone}"
            if (pfz.available and pfz.zone)
            else ("PFZ Active" if pfz.available else "No PFZ Advisory")
        )
        items.append(
            EvidenceItem(
                source=pfz.source,
                data_type="pfz_advisory",
                timestamp=pfz.issued_at,
                claim=p_claim,
                metric=pfz.zone or "PFZ",
                is_live=pfz.is_live,
            )
        )

    logger.info("Evidence built: %d items", len(items))
    return items
