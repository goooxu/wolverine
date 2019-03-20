const languages = ['Afrikaans', 'Albanian', 'Amharic', 'Arabic (Egyptian Spoken)', 'Arabic (Levantine)', 'Arabic (Modern Standard)', 'Arabic (Moroccan Spoken)', 'Arabic (Overview)', 'Aramaic', 'Armenian', 'Assamese', 'Aymara', 'Azerbaijani', 'Balochi', 'Bamanankan', 'Bashkort (Bashkir)', 'Basque', 'Belarusan', 'Bengali', 'Bhojpuri', 'Bislama', 'Bosnian', 'Brahui', 'Bulgarian', 'Burmese', 'Cantonese', 'Catalan', 'Cebuano', 'Chechen', 'Cherokee', 'Croatian', 'Czech', 'Dakota', 'Danish', 'Dari', 'Dholuo', 'Dutch', 'English', 'Esperanto', 'Estonian', 'Éwé', 'Finnish', 'French', 'Georgian', 'German', 'Gikuyu', 'Greek', 'Guarani', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hawaiian Creole', 'Hebrew', 'Hiligaynon', 'Hindi', 'Hungarian', 'Icelandic', 'Igbo', 'Ilocano', 'Indonesian (Bahasa Indonesia)', 'Inuit/Inupiaq', 'Irish Gaelic', 'Italian', 'Japanese', 'Jarai', 'Javanese', 'K’iche’', 'Kabyle', 'Kannada', 'Kashmiri', 'Kazakh', 'Khmer', 'Khoekhoe', 'Korean', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lingala', 'Lithuanian', 'Macedonian', 'Maithili', 'Malagasy', 'Malay (Bahasa Melayu)', 'Malayalam', 'Mandarin (Chinese)', 'Marathi', 'Mende', 'Mongolian', 'Nahuatl', 'Navajo', 'Nepali', 'Norwegian', 'Ojibwa', 'Oriya', 'Oromo', 'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Quechua', 'Romani', 'Romanian', 'Russian', 'Rwanda', 'Samoan', 'Sanskrit', 'Serbian', 'Shona', 'Sindhi', 'Sinhala', 'Slovak', 'Slovene', 'Somali', 'Spanish', 'Swahili', 'Swedish', 'Tachelhit', 'Tagalog', 'Tajiki', 'Tamil', 'Tatar', 'Telugu', 'Thai', 'Tibetic languages', 'Tigrigna', 'Tok Pisin', 'Turkish', 'Turkmen', 'Ukrainian', 'Urdu', 'Uyghur', 'Uzbek', 'Vietnamese', 'Warlpiri', 'Welsh', 'Wolof', 'Xhosa', 'Yakut', 'Yiddish', 'Yoruba', 'Yucatec', 'Zapotec', 'Zulu'];

function handleSubmit(e) {
    e.preventDefault();
    console.log(document.activeElement.id);
}

function FirstPage(props) {
    return (
        <div>
            <i className="material-icons">android</i>
            <h4>Bienvenue!</h4>
            <dl>
                {languages.map(language => <dt key={language}>{language}</dt>)}
            </dl>
            <div>
                <input type="submit" id="hello" value="COMMENCER"></input>
            </div>
        </div>
    );
}

function App(props) {
    return (
        <form onSubmit={handleSubmit}>
            <div className="main">
                <FirstPage />
            </div>
        </form >
    );
}

ReactDOM.render(<App />, document.querySelector('#root'));