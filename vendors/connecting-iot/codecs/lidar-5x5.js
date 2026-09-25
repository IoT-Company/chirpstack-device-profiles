/**
 * Connecting IOT LIDAR 5x5.
 *
 * A VL53L8CX time-of-flight sensor reporting a 5x5 grid of distances. fPort 2 carries a
 * 56-byte frame:
 *
 *   byte 0       device id
 *   bytes 1..4   the device's own clock, epoch seconds, big-endian
 *   byte 5       battery, percent
 *   bytes 6..55  25 distances, uint16 LITTLE-endian, millimetres
 *
 * **The frame is mixed-endian, and that is not a typo.** The header is packed big-endian by
 * hand; the grid is a memcpy of a uint16 array on a little-endian MCU. Read against the
 * sample frame in the original decoder's own header comment:
 *
 *     zones little-endian   min 1.604  max 2.510  mean 1.957 m
 *     zones big-endian      min 0.007  max 58.631 mean 31.761 m
 *     clock  big-endian     2024-08-02T11:29:04Z
 *     clock  little-endian  1970-05-29
 *
 * A VL53L8CX reaches a few metres. The little-endian grid is a sensor two metres off a
 * surface with the spread a 5x5 grid over uneven waste would have; the big-endian one is
 * noise up to 58 metres, and the clock is the other way round. Inferred from one frame, so
 * the firmware is still the authority -- but four independent readings agree.
 *
 * Four things differ from the standalone decoder this was written from, and each was a defect
 * rather than a preference:
 *
 *   1. The entry point is `decodeUplink(input)`. The original declared
 *      `Decode(payload, port)`, which is the ChirpStack v3 and TTN shape -- ChirpStack v4
 *      never calls it, so the device would have decoded to nothing at all.
 *   2. It reads `input.bytes` directly. The original ran its argument through a
 *      `HexToBytes` helper, so it expected a hex string; v4 hands over an array of numbers
 *      and converting one again yields nonsense.
 *   3. The distances are read little-endian. The original reads every field big-endian, which
 *      is right for the clock and wrong for the grid -- see above. This is the one that would
 *      not have announced itself: it produces numbers, and a fill level computed from them
 *      would simply have been wrong.
 *   4. `is_signed = false` inside a call site assigns to an undeclared global and passes
 *      the result positionally. It happens to work in sloppy mode and throws under
 *      "use strict". The distances are unsigned, so the argument is simply dropped.
 *
 * The distances come back as one `zones` array rather than 25 numbered fields. A grid is one
 * observation of one surface; twenty-five series named Afstand1..Afstand25 is the same data
 * spread so thin that nothing can read it back as a grid, and it fills a measurement registry
 * with keys nobody asked for.
 */

/** Big-endian unsigned integer out of a byte slice. Used for the hand-packed header. */
function beUint(bytes, start, length) {
  var value = 0;
  for (var i = 0; i < length; i++) {
    value = value * 256 + bytes[start + i];
  }
  return value;
}

/** Little-endian uint16. Used for the grid, which arrives in the MCU's native order. */
function leUint16(bytes, start) {
  return bytes[start] | (bytes[start + 1] << 8);
}

var FPORT_MEASUREMENT = 2;
var ZONE_COUNT = 25;
var HEADER_BYTES = 6;
var FRAME_BYTES = HEADER_BYTES + ZONE_COUNT * 2;

function decodeUplink(input) {
  var bytes = input.bytes;

  if (input.fPort !== FPORT_MEASUREMENT) {
    return { errors: ['unhandled fPort ' + input.fPort] };
  }
  if (bytes.length < FRAME_BYTES) {
    // Said rather than decoded part way: a short frame means the grid is incomplete, and half
    // a grid averaged into a fill level is worse than no reading.
    return {
      errors: ['expected ' + FRAME_BYTES + ' bytes on fPort 2, got ' + bytes.length],
    };
  }

  var zones = [];
  for (var i = 0; i < ZONE_COUNT; i++) {
    // Millimetres on the wire, metres out: the unit the rest of the world states a distance in.
    zones.push(leUint16(bytes, HEADER_BYTES + i * 2) / 1000);
  }

  return {
    data: {
      id: bytes[0],

      // The device's own clock, in seconds. Named `ts` because that is what a platform reading
      // this expects to find, and it matters: a sensor that buffers while out of coverage must
      // keep the time it measured at, not the time the network finally heard it.
      ts: beUint(bytes, 1, 4),

      battery: bytes[5],

      // 25 distances in metres, row-major across the 5x5 grid.
      zones: zones,
    },
  };
}
