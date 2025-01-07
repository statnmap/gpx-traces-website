# GPX Traces Map

![CI](https://github.com/statnmap/gpx-traces-website/workflows/Verify%20PR/badge.svg)

This repository contains the necessary files and code to use GPX files stored in the repository as input and show the GPX traces on an interactive map.

## Directory Structure

- `data/`: Directory to store processed data.
- `scripts/`: Directory to store scripts.
- `.github/workflows/`: Directory to store GitHub Actions workflows.

## Creating the GOOGLE_DRIVE_CREDENTIALS Secret

To create the `GOOGLE_DRIVE_CREDENTIALS` secret in your GitHub repository, follow these steps:

1. Go to your repository on GitHub.
2. Click on the "Settings" tab.
3. In the left sidebar, click on "Secrets".
4. Click on the "New repository secret" button.
5. In the "Name" field, enter `GOOGLE_DRIVE_CREDENTIALS`.
6. In the "Value" field, paste the content of your `credentials.json` file.
7. Click on the "Add secret" button.

This will create the `GOOGLE_DRIVE_CREDENTIALS` secret in your repository, which will be used by the GitHub Actions workflows to authenticate with Google Drive.

## How to create the content of the credentials.json ?

To create the content of the `credentials.json` file, follow these steps:

1. Go to the Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select an existing project.
3. Enable the Google Drive API for the project.
4. Create credentials for the project:
   - Go to the "Credentials" tab.
   - Click on the "Create credentials" button.
   - Select "Service account" from the dropdown menu.
   - Fill in the required information and click "Create".
   - On the "Grant this service account access to project" step, assign the "Viewer" role.
   - Click "Continue" and then "Done".
5. Download the JSON key file for the service account:
   - In the "Credentials" tab, find the service account you just created.
   - Click on the "Manage keys" button.
   - Click on the "Add key" button and select "Create new key".
   - Choose the JSON key type and click "Create".
   - The JSON key file will be downloaded to your computer.
6. Open the downloaded JSON key file and copy its content.
7. Use the copied content as the value for the `GOOGLE_DRIVE_CREDENTIALS` secret in your GitHub repository.

## Creating the GOOGLE_DRIVE_FOLDER_ID Secret

To create the `GOOGLE_DRIVE_FOLDER_ID` secret in your GitHub repository, follow these steps:

1. Go to your repository on GitHub.
2. Click on the "Settings" tab.
3. In the left sidebar, click on "Secrets".
4. Click on the "New repository secret" button.
5. In the "Name" field, enter `GOOGLE_DRIVE_FOLDER_ID`.
6. In the "Value" field, enter the ID of the specific folder on Google Drive.
7. Click on the "Add secret" button.

This will create the `GOOGLE_DRIVE_FOLDER_ID` secret in your repository, which will be used by the GitHub Actions workflows to specify the folder containing the GPX files.

## Creating the GOOGLE_DRIVE_FOLDER_ID_TEST Secret

To create the `GOOGLE_DRIVE_FOLDER_ID_TEST` secret in your GitHub repository, follow these steps:

1. Go to your repository on GitHub.
2. Click on the "Settings" tab.
3. In the left sidebar, click on "Secrets".
4. Click on the "New repository secret" button.
5. In the "Name" field, enter `GOOGLE_DRIVE_FOLDER_ID_TEST`.
6. In the "Value" field, enter the ID of the specific test folder on Google Drive.
7. Click on the "Add secret" button.

This will create the `GOOGLE_DRIVE_FOLDER_ID_TEST` secret in your repository, which will be used by the GitHub Actions workflows to specify the test folder containing the GPX files.

## Finding the ID of the GOOGLE_DRIVE_FOLDER_ID

To find the ID of the specific folder on Google Drive, follow these steps:

1. Go to Google Drive: https://drive.google.com/
2. Navigate to the folder you want to use.
3. Look at the URL in your browser's address bar. The folder ID is the long string of characters after `folders/` in the URL.
4. Copy this folder ID and use it as the value for the `GOOGLE_DRIVE_FOLDER_ID` secret in your GitHub repository.

## Activating Google Drive API

To activate the Google Drive API during the console.cloud.google.com process, follow these steps:

1. Go to the Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select an existing project.
3. In the left sidebar, click on "APIs & Services" and then "Library".
4. In the search bar, type "Google Drive API" and select it from the search results.
5. Click on the "Enable" button to activate the Google Drive API for your project.
6. Follow the steps to create credentials and download the JSON key file as described in the "How to create the content of the credentials.json?" section.

## Adding a New GPX File

To add a new GPX file, follow these steps:

1. Upload the new GPX file to the designated Google Drive folder.
2. Ensure the GPX file name includes the category ("sec", "inonde", "boueux") to map it to the correct category.
3. Run the pre-build script to process the GPX files and update the JSON file:
   ```sh
   node scripts/process-gpx.js
   ```

## Categories

The GPX traces are categorized into five categories:

- `parcours`: Files starting with "Parcours"
- `chemin_boueux`: Files containing "chemin" and "boueux"
- `chemin_inondable`: Files containing "chemin" and "inondable"
- `danger`: Files containing "danger"
- `autres`: Other files

The category is determined based on the GPX file name. Ensure the file name includes the category to map it correctly.

To update the categories, modify the `getCategory` function in the `scripts/process-gpx.js` file.

To update the effect of new categories on color and weight, modify the `getColor` and `getWeight` functions in the `scripts/map.js` file.

## GitHub Actions

The repository is configured to use GitHub Actions to build and deploy the website. The pre-build script is included in the build process to process the GPX files and update the JSON file whenever new GPX files are added or existing ones are modified.

## Deployment

The static website is hosted on GitHub Pages. The repository is configured to automatically build and deploy the website using GitHub Actions whenever changes are made to the GPX files or the codebase.

To add your current GPS position on the map when using a smartphone, follow these steps:

1. Open the website on your smartphone.
2. Click the "Add Current GPS Position" button.
3. Allow the website to access your location if prompted.
4. Your current GPS position will be added to the map with a marker.

## Trace Name

The trace name (`trace.name`) used in the application is derived from the GPX filename (without extension). Ensure the GPX filename is descriptive and includes the category to map it correctly.

## Running the Script Locally with Google Drive Credentials

To run the script locally while defining the `GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_DRIVE_CREDENTIALS` values during the Terminal session, follow these steps:

1. Open a Terminal session.
2. Install the required dependencies by running:
   ```sh
   npm install
   ``` 
3. Set the `GOOGLE_DRIVE_FOLDER_ID` environment variables by running:
   ```sh
   export GOOGLE_DRIVE_FOLDER_ID="your-folder-id"
   export GOOGLE_DRIVE_FOLDER_ID_TEST="your-test-folder-id"
   ```
   Replace `"your-folder-id"` with the actual folder ID from Google Drive.

4. Set the `GOOGLE_DRIVE_CREDENTIALS` environment variable by running:
   ```sh
   export GOOGLE_DRIVE_CREDENTIALS='{
     "type": "service_account",
     "project_id": "gpx-traces-website",
     "private_key_id": "your-private-key-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
     "client_email": "your-client-email",
     "client_id": "your-client-id",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-client-email"
   }'
   ```
   Replace the placeholders with the actual values from your `credentials.json` file.

5. Create the `credentials.json` file by running:
   ```sh
   echo '{
     "type": "service_account",
     "project_id": "gpx-traces-website",
     "private_key_id": "your-private-key-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
     "client_email": "your-client-email",
     "client_id": "your-client-id",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-client-email"
   }' > credentials.json
   ```
   Replace the placeholders with the actual values from your `credentials.json` file.

6. Run the pre-processing script by executing:
   ```sh
   node scripts/run-process-gpx.js
   ```

This will process the GPX files from the specified Google Drive folder and update the `traces-real/traces.json` file.

7. Run build locally
```sh
npm run build
```

8. Run the local server
```sh
webpack serve
```
Stop the server by pressing `Ctrl + C` in the terminal.

## Creating GPX Files for Unit Tests and Storing Them on Google Drive

To create the correct GPX files for unit tests and store them manually on the proper Google Drive, follow these steps:

1. Create the GPX files with the required content. Ensure the file names include the category ("parcours", "chemin_boueux", "chemin_inondable", "danger", "autres") to map them correctly.
2. Store the gpx files in the "test-gpx-files/" directory to record changes
3. Upload the GPX files to the designated test folder on Google Drive.
4. Find the ID of the test folder on Google Drive by navigating to the folder and copying the long string of characters after `folders/` in the URL.
5. Create the `GOOGLE_DRIVE_FOLDER_ID_TEST` secret in your GitHub repository with the test folder ID as the value. Refer to the instructions in the `README.md` file for creating secrets.

## Code Quality and Style Enforcement

The project uses ESLint for code quality and style enforcement. ESLint helps to identify and fix problems in the JavaScript code, ensuring that the codebase follows consistent coding standards.

The project also uses Prettier for code formatting. Prettier automatically formats the code according to a set of predefined rules, making the code more readable and maintainable.

To run ESLint and Prettier, use the following commands:

```sh
npm run lint
npm run format
```

## JavaScript Transpilation

The project uses Babel for JavaScript transpilation. Babel allows the use of modern JavaScript features by converting the code into a compatible version that can run in older browsers.

The Babel configuration can be found in the `babel.config.json` file.

## Bundling

The project uses Webpack for bundling the JavaScript code and other assets. Webpack helps to optimize the code and manage dependencies, making the project more efficient and easier to maintain.

The Webpack configuration can be found in the `webpack.config.js` file.

## Generating Documentation

The project uses JSDoc to generate documentation for the JavaScript code. JSDoc allows you to document your code using comments, and then generate an HTML documentation report.

To generate the documentation, use the following command:

```sh
npm run generate-docs
```

The generated documentation will be available in the `out/` directory.

## Deploying Documentation

The GitHub Actions workflow is configured to generate and deploy the documentation to a sub-directory of the gh-pages branch during CI/CD. The documentation will be available at `https://<username>.github.io/gpx-traces-website/docs/`.

## Simplifying GPX File Geometry

The code now includes a feature to simplify GPX file geometry while keeping one point every 10 meters. This helps reduce the size of GPX files and improve performance.

To achieve this, the `simplifyCoordinates` function was added to the `scripts/process-gpx.js` file. This function filters coordinates based on a 10-meter distance threshold.

The `getCoordinates` function in the `scripts/process-gpx.js` file was updated to use the `simplifyCoordinates` function.

Unit tests were added in the `tests/process-gpx.test.js` file to verify the simplification logic.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
