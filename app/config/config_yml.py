import os.path

import yaml


def load_config(file_path: str):
    with open(file_path, 'r') as file:
        config_data = yaml.safe_load(file)
        return config_data


current_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(current_dir, "application.yml")

config = load_config(file_path)
