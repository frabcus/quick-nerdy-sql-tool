var editor

var latest_error
var latest_error_important = false
var err = function(head, body, important) {
  console.log("got an error")

  if (important || !latest_error_important) {
    latest_error = '<h1>' + head + '</h1><p>' + body + '</p>'
  }

  clearTimeout(show_latest_error)
  if (!important) {
    setTimeout(show_latest_error, 1000)
  } else {
    show_latest_error()
  }
}
var show_latest_error = function() {
  if (latest_error) {
    console.log("error shown")
    $('#table').empty()
    $('#problem').html(latest_error)
    $('#problem').show()
  }
}
var clear_unimportant_errors = function() {
  console.log("clear_unimportant_errors", latest_error_important)
  if (!latest_error_important) {
    latest_error = null
    clearTimeout(show_latest_error)
  }
}

var real_run = function() {
  console.log("real_run called")

  var code = editor.getValue()
  scraperwiki.sql(code, function (response) {
      if (!response || response.length < 1) {
	err("No data", "The table is empty") 
      } else {
	var $head = $('<thead><tr></tr></thead>')
	$.each(response[0], function (key, value) {
	  $('tr', $head).append('<th>' + key + '</th>')
	})
       
	$('#problem').hide()
	$('#table').empty()
	$('#table').append($head)

	var $tbody = $('<tbody></tbody>')
	$.each(response, function (ix, table) {
	  var $row = $('<tr></tr>')
	  $.each(table, function (key, value) {
	    $row.append('<td>' + value + '</td>')
	  })
	  $tbody.append($row)
	})
	$('#table').append($tbody)
      }
      clear_run_debounced()
  }, function (response) {
      err("Error in SQL", jQuery.parseJSON(response.responseText))
      clear_run_debounced()
  })
}
var real_run_throttled = _.throttle(real_run, 750)

var real_save = function() {
  console.log("real_save called")

  var code = editor.getValue()
  var cmd = "mkdir -p code; cat >code/query.sql.$$.new <<ENDOFSCRAPER\n" + code + "\nENDOFSCRAPER\n"
  cmd = cmd + "mv code/query.sql.$$.new code/query.sql"
  scraperwiki.exec(cmd, function () {
  }, function (jqXHR, textStatus, errorThrown) { 
    err("Error saving query", textStatus, true) 
  })
}
var real_save_throttled = _.throttle(real_save, 750)

var clear_run = function() {
  $('#querying').text("")
}
var clear_run_debounced = _.debounce(clear_run, 750)

var run = function() {
  console.log("run called")

  $('#querying').text("Querying...")
  clear_unimportant_errors()

  real_save_throttled()
  real_run_throttled()
}

$(document).ready(function() {
  editor = ace.edit("editor")
  editor.renderer.setShowGutter(false)
  editor.setTheme("ace/theme/clouds")
  editor.getSession().setMode("ace/mode/sql")
  editor.renderer.setPadding(40) 
  scraperwiki.exec('mkdir -p code; touch code/query.sql; cat code/query.sql', function(data) {
    var firstTime = false
    data = data.replace(/\s\s*$/, '')
    if (data == "") {
      // data = "select * from "
      firstTime = true
    }
    editor.setValue(data)
    editor.clearSelection()
    editor.focus()
    if (!firstTime) {
      run()
    }
  })

  editor.on('change', function() {
    run()
  })

  scraperwiki.sql.meta(function (response) {
    $.each(response.table, function (table_name, table) {
      var html = '<h2 class="inserter">' + table_name + '</h2> <ul>' + 
	$.map(table.columnNames, function(col) { return '<li class="inserter">' + col + '</li>' }).join('') 
	+ "</ul>"
      var $table = $(html)
      $('#schema').append($table)
    })
    var lastCursorPosition = -1
    editor.on('change', function() {
      lastCursorPosition = -1
    })
    $('.inserter').click(function() {
      if (JSON.stringify(lastCursorPosition) == JSON.stringify(editor.getCursorPosition())) {
	editor.insert(', ')
      }
      editor.insert($(this).text())
      editor.focus()
      lastCursorPosition = editor.getCursorPosition()
    })
  }, function (jqXHR, textStatus, errorThrown) { err("Error getting schema", textStatus, true) } )
})

