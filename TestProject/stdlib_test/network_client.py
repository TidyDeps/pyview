"""Network client using standard library modules"""

import urllib.request
import urllib.parse
import http.client
import socket
from urllib.error import URLError


class NetworkClient:
    def __init__(self):
        self.timeout = 30

    def fetch_url(self, url):
        """Fetch URL using urllib"""
        try:
            with urllib.request.urlopen(url, timeout=self.timeout) as response:
                return response.read().decode('utf-8')
        except URLError as e:
            return f"Error: {e}"

    def encode_params(self, params):
        """Encode URL parameters"""
        return urllib.parse.urlencode(params)

    def get_host_ip(self, hostname):
        """Get IP address of hostname"""
        try:
            return socket.gethostbyname(hostname)
        except socket.gaierror:
            return None

    def check_connection(self, host, port=80):
        """Check if connection is possible"""
        try:
            conn = http.client.HTTPConnection(host, port, timeout=5)
            conn.connect()
            conn.close()
            return True
        except Exception:
            return False