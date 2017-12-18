const baseDir = {
  java: 'app/src/main/java/de/westnordost/streetcomplete/',
  res: 'app/src/main/res/'
};

let osmItems = [];

const drawableSizes = {
  mdpi: 128,
  hdpi: 192,
  xhdpi: 256,
  xxhdpi: 384
};
const drawableSizesNames = [
  'mdpi',
  'hdpi',
  'xhdpi',
  'xxhdpi'
];

let yesNoQuestTemplate;
let imageQuestTemplate;
let imageQuestFormTemplate;

let questModuleTemplate;
let stringValues;

$.get('./assets/templates/YesNoQuest.mst', function(template) {
  yesNoQuestTemplate = template;
});
$.get('./assets/templates/ImageQuest.mst', function(template) {
  imageQuestTemplate = template;
});
$.get('./assets/templates/ImageQuestForm.mst', function(template) {
  imageQuestFormTemplate = template;
});

$.get('./assets/templates/QuestModule.mst', function(template) {
  questModuleTemplate = template;
});
$.get('https://raw.githubusercontent.com/westnordost/StreetComplete/master/app/src/main/res/values/strings.xml', function(strings) {
  stringValues = strings;
});

$(document).ready(function() {
  $('select').material_select();
  $('.modal').modal({
    dismissible: false
  });

  $('select').css({
    display: 'block',
    height: 0,
    padding: 0,
    width: 0,
    position: 'absolute'
  });

  $('#form').validate({
    validClass: 'success',
    errorClass: 'invalid',
    errorPlacement: function(error, element) {
      element.next('label').attr('data-error', error.contents().text());
    },
    submitHandler: function(form, e) {
      e.preventDefault();
      generateFiles();
    }
  });

  //Set click listeners
  $('#create-new-quest').click(function() {
    clearInput();
  });
  $('#add-new-answer-button').click(function() {
    addNewAnswer();
  });
  $('#add-new-answer-close-button').click(function() {
    let osmVal = $('#osm-value').val();
    let answer = $('#answer').val();

    if (osmVal != '' || answer != '') {
      return Materialize.toast('Form is not empty!', 6000);
    }
    $('#osm-value').val('');
    $('#answer').val('');
    $('#image-select').val('');
    $('#preview-image').empty();
    $('#add-new-answer').modal('close');
  });
  $('.clear-input').click(function() {
    clearInput();
  });

  //Set change listeners
  $('#type').change(function() {
    $('#quest').fadeIn(500);
    $('#finish').fadeIn(500);

    switch ($('#type').val()) {
      case '1':
        $('#quest-form').hide();
        $('#yes-no-more-options').show();
        break;
      case '2':
        $('#yes-no-more-options').hide();
        $('#quest-form').fadeIn(500);
        break;
    }
  });
  $('#image-select').change(function() {
    processImage(this.files[0]);
  });
});

//Generate all files and zip them
function generateFiles() {
  //Check whether a template has not been loaded yet
  if (stringValues == null ||
    yesNoQuestTemplate == null ||
    imageQuestTemplate == null ||
    imageQuestFormTemplate == null ||
    questModuleTemplate == null) {
    return Materialize.toast('Can\'t create quest right now! Please try again later!', 6000);
  }

  $('.progress').fadeIn();

  const zip = new JSZip();

  //Required values
  let importance = $('#importance').val();
  let directory = $('#directory').val();
  let className = getClassNameFromDirectory(directory);
  let overpassQuery = $('#overpass').val();
  let osmTag = $('#osm-tag').val();
  let commitMessage = $('#commit').val();

  //Non-required values for the Yes-No quest
  let answerYes = $('#answer-yes').val();
  let answerNo = $('#answer-no').val();

  //Non-required values for the image quest form
  let imagesPerRow = $('#images-per-row').val();
  let initiallyShownAnswers = $('#initially-shown-answers').val();

  let stringArray = stringValues.split('\n');
  stringArray.splice(stringArray.length - 2, 0, '    <string name="quest_' + directory + '_title">' + $('#question').val() + '</string>');

  //Quest module which is needed for all quests
  let renderedQuestModule = Mustache.render(questModuleTemplate, {
    directory: directory,
    className: className,
    ['importance_' + $('#importance').val()]: true
  });
  //Add quest module to the zip archive
  zip.file(baseDir.java + 'quests/QuestModule.java', renderedQuestModule);

  switch ($('#type').val()) {
    //YesNo quest
    case '1':
      //Add new strings to strings.xml
      zip.file(baseDir.res + 'values/strings.xml', stringArray.join('\n'));

      let renderedYesNoQuest = Mustache.render(yesNoQuestTemplate, {
        directory: directory,
        className: className,
        overpass: overpassQuery,
        osmTag: osmTag,
        commitMessage: commitMessage,
        question: 'R.string.quest_' + directory + '_title',
        answerYes: answerYes || 'yes',
        answerNo: answerNo || 'no'
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedYesNoQuest);
      break;

      //Quest with images
    case '2':
      //Add new strings to strings.xml
      for (let i = 0; i < osmItems.length; i++) {
        if (osmItems[i].string != '') {
          let stringName = directory + '_' + osmItems[i].osmValue;
          stringArray.splice(stringArray.length - 2, 0, '    <string name="quest_' + stringName + '">' + osmItems[i].string + '</string>');
          osmItems[i].string = 'R.string.quest_' + stringName;
        }
      }
      zip.file(baseDir.res + 'values/strings.xml', stringArray.join('\n'));

      //Add new drawables
      for (let i = 0; i < osmItems.length; i++) {
        let drawableName = directory + '_' + osmItems[i].osmValue;

        for (let x = 0; x < Object.keys(drawableSizes).length; x++) {
          let drawableSizeName = drawableSizesNames[x];
          let drawableSize = drawableSizes[drawableSizeName];
          zip.file(baseDir.res + '/drawable-' + drawableSizeName + '/' + drawableName + '.jpg', resizeImage(osmItems[i].image, drawableSize));
        }
        osmItems[i].image = 'R.drawable.' + drawableName;
      }

      let renderedImageQuest = Mustache.render(imageQuestTemplate, {
        directory: directory,
        className: className,
        overpass: overpassQuery,
        osmTag: osmTag,
        commitMessage: commitMessage,
        question: 'R.string.quest_' + directory + '_title'
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedImageQuest);

      let renderedQuestForm = Mustache.render(imageQuestFormTemplate, {
        directory: directory,
        className: className,
        itemsPerRow: imagesPerRow,
        numberOfInitiallyShownItems: initiallyShownAnswers,
        osmItem: osmItems
      });
      //Add quest form to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + 'Form.java', renderedQuestForm);
      break;
  }

  //Generate zip archive
  zip.generateAsync({
      type: 'base64'
    })
    .then(function(content) {
      $('.download-zip')
        .attr('href', 'data:application/zip;base64,' + content)
        .attr('download', directory + '_quest.zip');

      $('#after-creation').show();
      $('.progress').fadeOut();
    });
}

function getClassNameFromDirectory(directory) {
  return 'Add' + directory.replace(/(?:_| |\b)(\w)/g, function(key) {
    return key.toUpperCase()
  }).replace(/_/g, '');
}

function processImage(file) {
  const reader = new FileReader();
  reader.onload = function(event) {
    let img = new Image();
    img.onload = function() {
      if (img.width != img.height) {
        return Materialize.toast('The selected image is not quadratic. Please select an image with the same width and height!', 6000);
      }
      if (img.width < drawableSizes.xxhdpi || img.height < drawableSizes.xxhdpi) {
        return Materialize.toast('The selected image is smaller than 384*384 pixels. Please select an image which is bigger.', 6000);
      }
      $('#preview-image').html(img);
    }
    img.src = event.target.result;
  }
  if (file != null) reader.readAsDataURL(file);
}

function resizeImage(data, size) {
  let img = new Image();
  img.src = data;
  let canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(img, 0, 0, size, size);
  return dataURItoBlob(canvas.toDataURL('image/jpeg', 0.8), 'image/jpeg');
}

function dataURItoBlob(dataURI, type) {
  let byteString = atob(dataURI.split(',')[1]);
  let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  let ab = new ArrayBuffer(byteString.length);
  let ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], {
    type: type
  });
}

function addNewAnswer() {
  let osmValue = $('#osm-value').val();
  let answer = $('#answer').val();
  let image = $('#preview-image').html();
  let imageSource = $('#preview-image').find('img').attr('src');

  if (osmValue == null || image == null) {
    return Materialize.toast('Please input all values', 6000);
  }

  osmItems.push({
    osmValue: osmValue,
    image: imageSource,
    string: answer
  });
  $('#add-new-answer').modal('close');
  $('#preview-quest-form-images').append('<div class="image-container">' + image +
    '<div class="text-container"><div class="text-bottom">' + answer +
    '</div></div></div>&nbsp;');
  clearAddAnswerModal();
}

function clearInput() {
  $('#after-creation').hide();
  $('#quest').hide();
  $('#quest-form').hide();
  $('#finish').hide();

  $('#type').val('0');
  $('#importance').val('0');
  $('select').material_select();

  $('#directory').val('');
  $('#overpass').val('');
  $('#osm-tag').val('');
  $('#commit').val('');
  $('#question').val('');

  $('#answer-no').val('');
  $('#answer-yes').val('');

  $('#images-per-row').val('');
  $('#initially-shown-answers').val('');
  clearAddAnswerModal();

  osmItems = [];
  stringArray = [];
  Materialize.updateTextFields();
}

function clearAddAnswerModal() {
  $('#osm-value').val('');
  $('#answer').val('');
  $('#image-select').val('');
  $('#preview-image').empty();
  Materialize.updateTextFields();
}
