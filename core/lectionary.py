import requests

def get_mass_readings(date):
    """
    Fetch Catholic Mass readings for a given date
    date format: YYYY-MM-DD
    """

    url = f"https://universalis.com/Europe.England.Westminster/{date}/jsonpmass.js"

    try:
        response = requests.get(url)
        data = response.json()

        gospel = data["Mass_R_Gospel"]["text"]
        reference = data["Mass_R_Gospel"]["source"]

        return {
            "gospel_reference": reference,
            "gospel_text": gospel
        }

    except Exception as e:
        return {
            "error": str(e)
        }