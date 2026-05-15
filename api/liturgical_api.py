import requests

def fetch_liturgical_data(date):

    year = date[:4]
    month_day = date[5:]

    url = f"https://cpbjr.github.io/catholic-readings-api/readings/{year}/{month_day}.json"

    print("Fetching:", url)

    try:
        response = requests.get(url)

        # CHECK IF EMPTY RESPONSE
        if response.text.strip() == "":
            print("❌ API returned empty response")
            return None

        data = response.json()
        return data

    except Exception as e:
        print("❌ Failed to fetch liturgical data:", e)
        return None