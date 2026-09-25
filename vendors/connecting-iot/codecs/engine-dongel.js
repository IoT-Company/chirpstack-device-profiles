function decodeUplink(input) {
  let bytes = input.bytes;
  let port = input.fPort; // Lees de poort van het bericht
  let decoded = {};

  // Functie om berichten op verschillende poorten te decoderen
  switch (port) {
    case 2:
      decoded = decodePort2msg(bytes);
      break;
    case 3:
      decoded = decodePort3msg(bytes);
      break;
    default:
      decoded = {};
  }

  return { data: decoded };
}

// Decoder voor berichten op poort 1
function decodePort2msg(bytes) {
  if (bytes.length < 4) {
    return {
      data: { error: "Payload too short" },
    };
  }
  let flagMask =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  let maskOffset = 4; // Start na de flagMask
  let decoded = {};

  function readParameter(
    name,
    length,
    bitPosition,
    factor = 1,
    offset = 0,
    signed = false
  ) {
    if (flagMask & (1 << bitPosition)) {
      if (maskOffset + length <= bytes.length) {
        let value = 0;
        for (let i = 0; i < length; i++) {
          value |= bytes[maskOffset + i] << (i * 8);
        }
        if (signed && value & (1 << (length * 8 - 1))) {
          value -= 1 << (length * 8);
        }
        decoded[name] = value * factor + offset;
        maskOffset += length;
      }
    }
  }

  let bitPos = 0;
  readParameter("Engine_Total_Idle_Hours", 4, bitPos++, 0.05);
  readParameter("Engine_Total_Idle_Fuel_Used", 4, bitPos++, 0.5);
  readParameter("Engine_Total_Hours_of_Operation", 4, bitPos++, 0.05);
  readParameter("Engine_Fuel_Rate", 2, bitPos++, 0.05);
  readParameter("Engine_Total_Fuel_Used", 4, bitPos++, 0.5);
  readParameter("Engine_Trip_Fuel", 4, bitPos++, 0.5);
  readParameter("Engine_Coolant_Temperature", 1, bitPos++, 1, -40);
  readParameter("Engine_Fuel_1_Temperature_1", 1, bitPos++, 1, -40);
  readParameter("Engine_Oil_Pressure_1", 1, bitPos++, 4);
  readParameter("Engine_Oil_Level", 1, bitPos++, 0.4);
  readParameter("Engine_Coolant_Level_1", 1, bitPos++, 0.4);
  readParameter("Engine_Coolant_Pressure_1", 1, bitPos++, 2);
  readParameter("Engine_Fuel_Delivery_Pressure", 1, bitPos++, 4);
  readParameter("Engine_Speed", 2, bitPos++, 0.125);
  readParameter("Engine_Demand_Percent_Torque", 1, bitPos++, 1, -125);
  readParameter("Actual_Engine_Percent_Torque", 1, bitPos++, 1, -125);
  readParameter("Drivers_Demand_Engine_Percent_Torque", 1, bitPos++, 1, -125);
  readParameter("Battery_Potential_Power_Input_1", 2, bitPos++, 0.05);
  readParameter("Engine_Percent_Load_At_Current_Speed", 1, bitPos++);
  readParameter("Accelerator_Pedal_1_Position", 1, bitPos++, 0.4);
  readParameter("Fuel_Level_1", 1, bitPos++, 0.4);
  readParameter("Fuel_Level_2", 1, bitPos++, 0.4);
  readParameter("Engine_Turbocharger_1_Boost_Pressure", 2, bitPos++, 0.125);
  readParameter("Engine_Turbocharger_2_Boost_Pressure", 2, bitPos++, 0.125);

  return decoded;
}

function decodePort3msg(msg3) {
  let data = {};
  data.Diagnostic_Lamp_Status = {};
  // lamp status
  if ((msg3[0] & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.ProtectLampStatus = "Off";
  } else if ((msg3[0] & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.ProtectLampStatus = "On";
  } else if ((msg3[0] & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.ProtectLampStatus = "Reserved";
  } else if ((msg3[0] & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.ProtectLampStatus = "Not available";
  }

  if (((msg3[0] >> 2) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.AmberWarningLampStatus = "Off";
  } else if (((msg3[0] >> 2) & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.AmberWarningLampStatus = "On";
  } else if (((msg3[0] >> 2) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.AmberWarningLampStatus = "Reserved";
  } else if (((msg3[0] >> 2) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.AmberWarningLampStatus = "Not available";
  }

  if (((msg3[0] >> 4) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.RedStopLampStatus = "Off";
  } else if (((msg3[0] >> 4) & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.RedStopLampStatus = "On";
  } else if (((msg3[0] >> 4) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.RedStopLampStatus = "Reserved";
  } else if (((msg3[0] >> 4) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.RedStopLampStatus = "Not available";
  }

  if (((msg3[0] >> 6) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.MalfunctionLampStatus = "Off";
  } else if (((msg3[0] >> 6) & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.MalfunctionLampStatus = "On";
  } else if (((msg3[0] >> 6) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.MalfunctionLampStatus = "Reserved";
  } else if (((msg3[0] >> 6) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.MalfunctionLampStatus = "Not available";
  }

  // flash status of lamps
  if ((msg3[1] & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.ProtectLampFlashStatus = "Slow Flash";
  } else if ((msg3[1] & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.ProtectLampFlashStatus = "Fast Flash";
  } else if ((msg3[1] & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.ProtectLampFlashStatus = "Reserved";
  } else if ((msg3[1] & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.ProtectLampFlashStatus = "No Flash";
  }

  if (((msg3[1] >> 2) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.AmberWarningLampFlashStatus = "Slow Flash";
  } else if (((msg3[1] >> 2) & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.AmberWarningLampFlashStatus = "Fast Flash";
  } else if (((msg3[1] >> 2) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.AmberWarningLampFlashStatus = "Reserved";
  } else if (((msg3[1] >> 2) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.AmberWarningLampFlashStatus = "No Flash";
  }

  if (((msg3[1] >> 4) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.RedStopLampFlashStatus = "Slow Flash";
  } else if (((msg3[1] >> 4) & 0b11) == 1) {
    data.Diagnostic_Lamp_Status.RedStopLampFlashStatus = "Fast Flash";
  } else if (((msg3[1] >> 4) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.RedStopLampFlashStatus = "Reserved";
  } else if (((msg3[1] >> 4) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.RedStopLampFlashStatus = "No Flash";
  }

  if (((msg3[1] >> 6) & 0b11) == 0) {
    data.Diagnostic_Lamp_Status.MalfunctionLampFlashStatus = "Slow Flash";
  } else if (((msg3[1] >> 6) & 0b11) == 1) {
    data.Diagnostic_Lamp_StatusMalfunctionLampFlashStatus = "Fast Flash";
  } else if (((msg3[1] >> 6) & 0b11) == 2) {
    data.Diagnostic_Lamp_Status.MalfunctionLampFlashStatus = "Reserved";
  } else if (((msg3[1] >> 6) & 0b11) == 3) {
    data.Diagnostic_Lamp_Status.MalfunctionLampFlashStatus = "No Flash";
  }

  const dtcCnt = Math.floor((msg3.length - 2) / 4);

  data.Diagnostic_Trouble_Codes = [];
  for (let i = 0; i < dtcCnt; i++) {
    let cm = (msg3[5 + i * 4] >> 7) & 0b1;

    if (cm == 0) {
      let spn =
        ((msg3[4 + i * 4] >> 5) << 16) |
        (msg3[3 + i * 4] << 8) |
        msg3[2 + i * 4];
      let fmi = msg3[4 + i * 4] & 0b11111;
      let oc = msg3[5 + i * 4] & 0b1111111;

      if (spn != 0) {
        data.Diagnostic_Trouble_Codes.push({ spn: spn, fmi: fmi, oc: oc });
      }
    }
  }

  return data;
}
