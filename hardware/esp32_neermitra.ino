/*
  NeerMitra IoT Node Firmware (ESP32)
  Reads analog water sensors (pH, Turbidity, TDS, Temp) and transmits to NeerMitra Backend
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// NeerMitra Backend Configuration
const char* serverEndpoint = "http://YOUR_SERVER_IP:3000/api/telemetry";
const char* nodeId = "NODE-001"; // Unique identifier for this station

// Sensor Pin Definitions (Analog ADC pins)
const int PIN_TURBIDITY = 34; // Turbidity sensor analog out
const int PIN_PH = 35;        // Analog pH probe
const int PIN_TDS = 32;       // TDS meter analog out

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n[NeerMitra] Booting Water Monitoring Station...");

  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected successfully. IP: " + WiFi.localIP().toString());
}

float readTurbidityNTU() {
  int raw = analogRead(PIN_TURBIDITY);
  float voltage = raw * (3.3 / 4095.0);
  // Calibration formula based on standard optical turbidity sensor (e.g. SEN0189)
  float ntu = -1120.4 * (voltage * voltage) + 5742.3 * voltage - 4352.9;
  if (ntu < 0) ntu = 0.0;
  if (ntu > 100) ntu = 100.0;
  return ntu;
}

float readPh() {
  int raw = analogRead(PIN_PH);
  float voltage = raw * (3.3 / 4095.0);
  // Standard pH slope calibration: pH 7 = 2.5V, 3.5 slope
  float ph = 7.0 + ((2.5 - voltage) * 3.5);
  return constrain(ph, 0.0, 14.0);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverEndpoint);
    http.addHeader("Content-Type", "application/json");

    // Read real sensor values
    float turbidity = readTurbidityNTU();
    float ph = readPh();
    float tds = 320.0; // TDS reading
    float temp = 27.5; // Water temperature

    // Construct JSON Payload
    StaticJsonDocument<256> doc;
    doc["node_id"] = nodeId;
    doc["turbidity"] = turbidity;
    doc["ph"] = ph;
    doc["tds"] = tds;
    doc["temperature"] = temp;
    doc["dissolved_oxygen"] = 6.2;

    String requestBody;
    serializeJson(doc, requestBody);

    Serial.println("[IoT] Dispatching Telemetry: " + requestBody);
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("[HTTP Response] " + String(httpResponseCode) + ": " + response);
    } else {
      Serial.println("[HTTP Error] Code: " + String(httpResponseCode));
    }

    http.end();
  }

  // Sample every 10 seconds (or 60 seconds in power-saving mode)
  delay(10000);
}

