(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
$.get('./assets/strings.xml', function(strings) {
  stringValues = new XMLSerializer().serializeToString(strings.documentElement);
  stringValues = '<?xml version="1.0" encoding="utf-8"?>\n' + stringValues + '\n';
});
//$.get('https://raw.githubusercontent.com/westnordost/StreetComplete/master/app/src/main/res/values/strings.xml', function(strings) {
//stringValues = strings;
//});

$(document).ready(function() {
  $('select').material_select();
  $('.modal').modal();
  $('#enabled').prop('checked', true);

  $('#form').validate({
    rules: {
      //TODO: Implement own rule for select inputs
      importance: {
        required: true
      },
      type: {
        required: true
      },
      directory: {
        required: true
      },
      overpass: {
        required: true
      },
      osmtag: {
        required: true
      },
      commit: {
        required: true
      },
      question: {
        required: true
      },
      imagesPerRow: {
        required: function(element) {
          return $('#quest-form').is(':visible');
        }
      },
      osmValue: {
        required: function(element) {
          return $('#quest-form').is(':visible');
        }
      },
      answer: {
        required: function(element) {
          return $('#quest-form').is(':visible');
        }
      },
      imageSelect: {
        required: function(element) {
          return $('#quest-form').is(':visible');
        }
      }
    },
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
    $('#osm-value').val('');
    $('#answer').val('');
    $('#file-path').val('');
    $('#preview-image').empty();
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
        break;
      case '2':
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

  let importance = $('#importance').val();
  let directory = $('#directory').val();
  let className = getClassNameFromDirectory(directory);
  let overpassQuery = $('#overpass').val();
  let osmTag = $('#osm-tag').val();
  let commitMessage = $('#commit').val();
  let enabled = $('#enabled').is(':checked');

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
        enabled: enabled,
        question: 'R.string.quest_' + directory + '_title'
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedYesNoQuest);
      break;

      //Quest with images
    case '2':
      //Add new strings to strings.xml
      for (let i = 0; i < osmItems.length; i++) {
        let stringName = directory + '_' + osmItems[i].osmValue;
        stringArray.splice(stringArray.length - 2, 0, '    <string name="quest_' + stringName + '">' + osmItems[i].string + '</string>');
        osmItems[i].string = 'R.string.quest_' + stringName;
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
        enabled: enabled,
        question: 'R.string.quest_' + directory + '_title'
      });
      //Add quest to the zip archive
      zip.file(baseDir.java + 'quests/' + directory + '/' + className + '.java', renderedImageQuest);

      let renderedQuestForm = Mustache.render(imageQuestFormTemplate, {
        directory: directory,
        className: className,
        itemsPerRow: $('#images-per-row').val(),
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
  reader.readAsDataURL(file);
}

function resizeImage(data, size) {
  let img = new Image();
  img.src = data;
  let canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(img, 0, 0, size, size);
  return dataURItoBlob(canvas.toDataURL('image/jpeg', 1), 'image/jpeg');
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
  let image = $('#preview-image').find('img').attr('src');

  osmItems.push({
    osmValue: osmValue,
    image: image,
    string: answer
  });
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
  $('#enabled').prop('checked', true);

  $('#images-per-row').val('');
  $('#osm-value').val('');
  $('#answer').val('');
  $('#file-path').val('');
  $('#preview-image').empty();

  osmItems = [];
  stringArray = [];
  Materialize.updateTextFields();
}

},{}]},{},[1]);
