// Roadster Jump tuning: every physics and feel number (SI units, car frame +Y up, +Z forward, +X left), based on Roadster 88 shared/tuning.json with the suction fan, faster air rotation and lighter angular drag for flips.
export const TUNING = {
  physics_hz: 120,
  gravity: 9.81,
  air_density: 1.225,
  car: {
    mass: 1950,
    com: [0.0, 0.45, -0.10],
    inertia: { pitch: 2800, yaw: 3100, roll: 690 },
    wheelbase: 2.792,
    track_front: 1.590,
    track_rear: 1.580,
    length: 4.24,
    width: 1.89,
    height: 1.178,
    collider_box: { size: [1.86, 0.76, 4.18], center: [0.0, 0.58, 0.09] },
  },
  wheels: {
    radius_front: 0.352, radius_rear: 0.358, width_front: 0.275, width_rear: 0.305,
    inertia_each: 1.9, max_steer_deg: 36,
    steer_speed_falloff: { full_until: 12, min_factor: 0.3, at: 70 },
    steer_rate_deg_s: 360, ackermann: 0.6,
  },
  suspension: {
    rest_length: 0.36, travel: 0.13, spring_front: 54000, spring_rear: 58000,
    damper_bump: 4300, damper_rebound: 5600, antiroll_front: 30000, antiroll_rear: 22000, bump_stop_k: 400000,
  },
  tyres: {
    mu_long: 1.75, mu_lat: 1.75, peak_slip_ratio: 0.10, peak_slip_angle_deg: 6.0,
    falloff_long: 0.92, falloff_lat: 0.95, load_sensitivity: 0.04, relaxation_length: 0.35, rolling_resistance: 0.012,
  },
  powertrain: {
    max_power_kw: 950, max_wheel_force: 30000, front_share: 0.42, limiter_mph: 250, reverse_max_mph: 25,
    regen_force: 9000, brake_force: 42000, brake_front_share: 0.62, traction_control: 0.12, motor_rpm_per_mps: 520,
  },
  thrusters: {
    rear: { thrust_each: 5500, positions: [[0.36, 0.495, -1.975], [0.12, 0.495, -1.975], [-0.12, 0.495, -1.975], [-0.36, 0.495, -1.975]], pitch_range_deg: [0, 95], side_deflect_deg: 30, exit_m: 0.077 },
    front: { thrust_each: 9000, positions: [[0.40, 0.29, 2.02], [-0.40, 0.29, 2.02]], pitch_range_deg: [0, 95], side_deflect_deg: 30, deploy_time_s: 0.30, retract_delay_s: 1.2, deploy_travel_m: 0.13, exit_m: 0.062 },
    side: { thrust_each: 4500, positions: [[0.80, 0.165, 0.86], [0.80, 0.165, -0.90], [-0.80, 0.165, 0.86], [-0.80, 0.165, -0.90]], pitch_range_deg: [-30, 30], side_deflect_deg: 30, deploy_time_s: 0.25, retract_delay_s: 1.2, deploy_travel_m: 0.055, exit_m: 0.052 },
    valve_open_s: 0.05, valve_close_s: 0.08, gimbal_rate_deg_s: 520, hop_tap_max_s: 0.25,
    ground_effect: { height: 1.5, boost: 0.12 },
  },
  flight: {
    rate_deg_s: { pitch: 190, yaw: 140, roll: 330 },
    rate_gain: 5.0,
    level_kp: 10.0, level_kd: 4.2,
    level_time_s: 1.15,
    land_rate: [1.4, 0.75, 22],
    air_speed_governor_mph: [232, 250],
  },
  suction: { base_g: 0.35, attitude_g: 0.75, spool_s: 0.55, seal_gap: 0.45 },
  aero: { cd_a: 0.62, lift_a: 0.02, angular_drag: [520, 600, 110] },
  camera: { chase_distance: 6.2, chase_height: 1.7, fov: 62, fov_max: 76, fov_full_at_mph: 160, recentre_after_s: 1.6 },
};
