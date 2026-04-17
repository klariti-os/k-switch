#include <WiFi.h>
#include <HTTPClient.h>

#define LED_BUILTIN 10

const char* SSID     = "drena";
const char* PASSWORD = "Chulio123";
const char* TOGGLE_URL = "https://k-switch.vercel.app/state/toggle";

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected, IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(TOGGLE_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST("");
    Serial.printf("POST /state/toggle -> %d\n", code);
    http.end();
  } else {
    Serial.println("WiFi disconnected, reconnecting...");
    WiFi.reconnect();
  }

  delay(2000);
}
