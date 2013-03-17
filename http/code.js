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
      clear_unimportant_errors()

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

var loaded_empty
var load = function() {
  scraperwiki.exec('mkdir -p code; touch code/query.sql; cat code/query.sql', function(data) {
    data = data.replace(/\s\s*$/, '')
    if (data == "") {
      loaded_empty = true
      use_default_query_if_needed()
    } else {
      editor.setValue(data)
      editor.clearSelection()
      editor.focus()
      run()
      editor.on('change', run)
    }
  })
}
var use_default_query_if_needed = function() {
  if (meta && loaded_empty) {
    if (editor.getValue() == "") {
      use_default_query()
      run()
      editor.on('change', run)
    }
  }
}
var use_default_query = function() {
  table = Object.keys(meta.table)[0]
  cols = meta.table[table].columnNames
  data = "select \n" +
      "\t" + cols.slice(0, 3).join(",\n\t") + "\n" +
      "from " + table + "\n"
  if (cols.length > 2) {
      data += "-- where " + cols[Math.min(cols.length, 2)] + " > \n" +
	      "order by " + cols[1] + "\n"
  }
  data += "limit 20" + "\n"

  editor.setValue(data)
  editor.clearSelection()
  editor.focus()
}
var use_group_query = function() {
  table = Object.keys(meta.table)[0]
  cols = meta.table[table].columnNames
  var col = Math.min(cols.length, 2)
  data = "select \n" +
      "\t" + cols[col] + ",\n" +
      "\tcount(*) as c\n" +
      "from " + table + "\n"
  data += "group by " + cols[col] + "\n"
  data += "order by c desc\n"
  data += "limit 20" + "\n"

  editor.setValue(data)
  editor.clearSelection()
  editor.focus()
}

var clear_run = function() {
  $('#loading').hide()
}
var clear_run_debounced = _.debounce(clear_run, 750)

var run = function() {
  console.log("run called")

  $('#loading').show()
  clear_unimportant_errors()

  real_save_throttled()
  real_run_throttled()
}

// http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

var meta = null
var get_meta = function() {
  scraperwiki.sql.meta(function (response) {
    meta = response
    use_default_query_if_needed()

    $.each(response.table, function (table_name, table) {
      var html = '<h2 class="inserter">' + table_name + '</h2> <ul>'
      _.each(table.columnNames, function(colname){
        html += '<li id="colhelp' + table_name.hashCode() + colname.hashCode() + '"><span class="inserter">' + colname + '<span></li>'
      })
      html += '</ul>'
      $('#schema').append(html)

      scraperwiki.sql("select * from " + table_name + " order by random() limit 1", function (response) {
        if (!response) {
          return
        }
  	$.each(response[0], function (key, value) {
	  var code = '#colhelp' + table_name.hashCode() + key.hashCode()
          if (value.length > 30) {
            value = value.substr(0, 30) + "&hellip;"
          }
	  var txt = "e.g. '" + value + "'"
	  /* not sure if this is worth it or just clutter - if enabling change limit 1 above to limit 2
          if (response.length > 1) {
	    txt += ", '" + response[1][key] + "'"
          } */
	  $(code).append(" <span class='example'>" + txt + "</span>")
  	})
       }, function (jqXHR, textStatus, errorThrown) { err("Error getting sample rows", textStatus, true) } )
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
}

$(function() {
  editor = ace.edit("editor")
  editor.renderer.setShowGutter(false)
  editor.session.setUseWrapMode(true);
  editor.session.setWrapLimitRange(null, null);
  editor.setTheme("ace/theme/clouds")
  editor.getSession().setMode("ace/mode/sql")
  load()
  get_meta()
  $('#run').on('click', run)
})

