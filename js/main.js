const baseDir = {
  java: 'app/src/main/java/de/westnordost/streetcomplete/',
  res: 'app/src/main/res/'
};

const drawable = {
  size: {
    mdpi: 128,
    hdpi: 192,
    xhdpi: 256,
    xxhdpi: 384
  },
  name: [
    'mdpi',
    'hdpi',
    'xhdpi',
    'xxhdpi'
  ]
};

let yesNoQuestTemplate;
let imageQuestTemplate;
let imageQuestFormTemplate;

let questModuleTemplate;
let stringValues;

let osmItems = [];
let otherAnswers = [];

let icon = 'ic_quest_star';

Helper.loadPartials();

Helper.get('./assets/templates/YesNoQuest.mst', function(data) {
  yesNoQuestTemplate = data;
});
Helper.get('./assets/templates/ImageQuest.mst', function(data) {
  imageQuestTemplate = data;
});
Helper.get('./assets/templates/ImageQuestForm.mst', function(data) {
  imageQuestFormTemplate = data;
});

Helper.get('./assets/templates/QuestModule.mst', function(data) {
  questModuleTemplate = data;
});
Helper.get('https://raw.githubusercontent.com/westnordost/StreetComplete/master/app/src/main/res/values/strings.xml', function(data) {
  stringValues = data;
});

Helper.get('https://cdn.rawgit.com/westnordost/StreetComplete/bf6957a6/app/src/main/java/de/westnordost/streetcomplete/quests/QuestModule.java', function(questModule) {
  Helper.get('https://rawgit.com/westnordost/StreetComplete/master/app/src/main/java/de/westnordost/streetcomplete/quests/QuestModule.java', function(githubQuestModule) {
    //Check if there are changes in the QuestModule.java and if yes notify the user
    if (questModule != githubQuestModule) {
      return $('#can-not-work').modal('open');
    }
  });
});

$(document).ready(function() {
  $('#type').material_select();
  $('#importance').material_select();

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
  Helper.setListeners();
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
  let directory = Helper.correctDirectory($('#directory').val());
  let className = Helper.getClassNameFromDirectory(directory);
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
        answerNo: answerNo || 'no',
        icon: icon
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedYesNoQuest);
      break;

      //Quest with images
    case '2':
      //Add new strings to strings.xml
      for (let i = 0; i < osmItems.length; i++) {
        if (osmItems[i].string != '') {
          let stringName = 'quest_' + directory + '_' + osmItems[i].osmValue;
          stringArray.splice(stringArray.length - 2, 0, '    <string name="' + stringName + '">' + osmItems[i].string + '</string>');
          osmItems[i].string = 'R.string.' + stringName;
        }
      }
      //Add other answers if they exist
      if (otherAnswers.length > 0) {
        for (let i = 0; i < otherAnswers.length; i++) {
          let stringName = 'quest_' + directory + '_' + otherAnswers[i].osmValue;
          stringArray.splice(stringArray.length - 2, 0, '    <string name="' + stringName + '">' + otherAnswers[i].string + '</string>');
          otherAnswers[i].string = 'R.string.' + stringName;
        }
      }
      zip.file(baseDir.res + 'values/strings.xml', stringArray.join('\n'));

      //Add new drawables
      for (let i = 0; i < osmItems.length; i++) {
        let drawableName = directory + '_' + osmItems[i].osmValue;

        for (let x = 0; x < drawable.name.length; x++) {
          let drawableSizeName = drawable.name[x];
          let drawableSize = drawable.size[drawableSizeName];
          zip.file(baseDir.res + '/drawable-' + drawableSizeName + '/' + drawableName + '.jpg', Helper.resizeImage(osmItems[i].image, drawableSize));
        }
        osmItems[i].image = 'R.drawable.' + drawableName;
      }

      let renderedImageQuest = Mustache.render(imageQuestTemplate, {
        directory: directory,
        className: className,
        overpass: overpassQuery,
        osmTag: osmTag,
        commitMessage: commitMessage,
        question: 'R.string.quest_' + directory + '_title',
        otherAnswers: otherAnswers,
        icon: icon
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedImageQuest);

      let renderedQuestForm = Mustache.render(imageQuestFormTemplate, {
        directory: directory,
        className: className,
        itemsPerRow: imagesPerRow,
        numberOfInitiallyShownItems: initiallyShownAnswers,
        osmItem: osmItems,
        otherAnswers: otherAnswers
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

function addNewAnswer() {
  let osmValue = $('#osm-value').val();
  let answer = $('#answer').val();
  let image = $('#preview-image').html();
  let imageSource = $('#preview-image').find('img').attr('src');

  if (osmValue == '' || image == '') {
    return Materialize.toast('Please input all values', 6000);
  } else {
    osmItems.push({
      osmValue: osmValue,
      image: imageSource,
      string: answer
    });
    $('#add-new-answer').modal('close');

    $('#preview-quest-form-images').append(
      '<div class="image-container">' + image +
      '<div class="text-container">' +
      '<div class="text-bottom">' + answer + '</div>' +
      '</div>' +
      '</div>&nbsp;');

    clearAddAnswerModal();
  }
}

function addOtherAnswer() {
  let answer = $('#other-answer').val();
  let osmValue = $('#other-answer-value').val();

  if (osmValue == '' || answer == '') {
    return Materialize.toast('Please input all values', 6000);
  } else {
    otherAnswers.push({
      string: answer,
      osmValue: osmValue
    });
    $('#add-other-answer').modal('close');
    $('#other-answers-list').append('<li>&bull;' + answer + '</li>');
    clearAddOtherAnswerModal();
  }
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
  clearAddOtherAnswerModal();

  osmItems = [];
  otherAnswers = [];
  stringArray = [];
  icon = 'ic_quest_star';
  Materialize.updateTextFields();
}

function clearAddAnswerModal() {
  $('#osm-value').val('');
  $('#answer').val('');
  $('#image-select').val('');
  $('#preview-image').empty();
  Materialize.updateTextFields();
}

function clearAddOtherAnswerModal() {
  $('#other-answer').val('');
  $('#other-answer-value').val('');
  Materialize.updateTextFields();
}
