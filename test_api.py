import requests

url = "https://cpbjr.github.io/catholic-readings-api/readings/2026/05-18.json"

try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    print(response.json())
except requests.RequestException as err:
    print(f"Request failed: {err}")
